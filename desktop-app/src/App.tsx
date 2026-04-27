import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SettingsPanel } from './components/SettingsPanel';
import { BottomBar } from './components/BottomBar';
import { LegalModal } from './components/LegalModal';
import { VideoFile, CompressionSettings, Language } from './types';
import { TRANSLATIONS } from './constants';
import { open } from '@tauri-apps/plugin-dialog';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { compressVideo, compressImage, getFileInfo } from './lib';
import { LicenseStatusModal } from './components/LicenseStatusModal';
import { LoginModal } from './components/LoginModal';
import { DeviceManagerModal } from './components/DeviceManagerModal';
import { ReceivedFilesModal, type ReceivedFile } from './components/ReceivedFilesModal';
import { ToastStack, type ToastItem } from './components/Toast';
import { FolderSidebar, type FolderScanSummary } from './components/FolderSidebar';
import { FileText, Folder as FolderIcon } from 'lucide-react';
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';
import { registerDesktopDevice, startHeartbeat } from './deviceRegistration';

// 첫 실행 시 언어 결정 — localStorage 저장값 우선, 없으면 OS 언어 감지, 그것도 안 되면 영어.
// 시스템 언어 매칭이 잘못될 가능성이 있어 헤더 selector는 그대로 두고 유저가 언제든 변경 가능.
const SUPPORTED_LANGUAGES: Language[] = ['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'pt', 'ru', 'hi'];

function detectInitialLanguage(): Language {
    try {
        const saved = localStorage.getItem('VL_LANGUAGE');
        if (saved && SUPPORTED_LANGUAGES.includes(saved as Language)) {
            return saved as Language;
        }
    } catch {
        // localStorage 접근 실패 — privacy mode 등. fallback으로 진행.
    }
    // navigator.language: "ko-KR", "en-US", "zh-CN" 형식 → 앞 2글자만 비교.
    const raw = (typeof navigator !== 'undefined' ? navigator.language : '') || 'en';
    const code = raw.slice(0, 2).toLowerCase() as Language;
    return SUPPORTED_LANGUAGES.includes(code) ? code : 'en';
}

// 완료 Toast subtitle용 간단 포매터. 크기 단위 자동 선택.
function formatBytesShort(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

const App: React.FC = () => {
    const PAID_OFFLINE_GRACE_HOURS = 72;
    const VIDEO_EXTENSIONS = new Set([
        'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv', 'flv', 'mpeg', 'mpg'
    ]);
    const IMAGE_EXTENSIONS = new Set([
        'jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'
    ]);
    const APP_UPDATE_META_URL = 'https://velo.smileon.app/desktop-version.json';

    const getPathExtension = (path: string) => {
        const lastDot = path.lastIndexOf('.');
        if (lastDot < 0) return '';
        return path.slice(lastDot + 1).toLowerCase();
    };

    const isVideoPath = (path: string) => VIDEO_EXTENSIONS.has(getPathExtension(path));
    const isImagePath = (path: string) => IMAGE_EXTENSIONS.has(getPathExtension(path));

    const [processingMode, setProcessingMode] = useState<'video' | 'image'>('video');
    // 입력 방식 — 개별 파일 단위 (기존) vs 폴더 단위.
    // processingMode(video/image)와 직교하는 별개 축.
    const [inputMode, setInputMode] = useState<'file' | 'folder'>('file');
    // 폴더 모드 전용 — 스캔 요약. 파일 목록 자체는 기존 `files` state 재사용.
    const [folderScan, setFolderScan] = useState<FolderScanSummary | null>(null);

    const isAcceptedPath = (path: string) => {
        return processingMode === 'video' ? isVideoPath(path) : isImagePath(path);
    };

    // --- State ---
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    // 초기값은 첫 실행 시에만 함수 평가. 이후 setLanguage로 변경 + localStorage 동기화.
    const [language, setLanguage] = useState<Language>(() => detectInitialLanguage());
    const [isActivated, setIsActivated] = useState<boolean>(false);
    const [showActivation, setShowActivation] = useState<boolean>(false);
    const [showLicenseStatus, setShowLicenseStatus] = useState<boolean>(false);
    const [isLicensingReady, setIsLicensingReady] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<{
        latestVersion: string;
        downloadUrl: string;
    } | null>(null);

    // Velo 계정 세션 — 모바일과 같은 Supabase auth.users 공유
    const [session, setSession] = useState<Session | null>(null);
    const [showLogin, setShowLogin] = useState<boolean>(false);
    const [showDevices, setShowDevices] = useState<boolean>(false);
    const [currentMachineId, setCurrentMachineId] = useState<string | null>(null);

    // 폰으로부터 받은 파일 내역 — 수신 이벤트를 누적 (최근 50건 제한).
    const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
    const [saveDir, setSaveDir] = useState<string | null>(null);
    const [showReceived, setShowReceived] = useState<boolean>(false);

    // 수신 알림 toast. file-received 이벤트마다 우상단에 3.5초 표시.
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const pushToast = useCallback((t: Omit<ToastItem, 'id'>) => {
        setToasts((prev) => [...prev, { ...t, id: crypto.randomUUID() }]);
    }, []);
    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);
    // 이벤트 listener는 마운트 시 한 번만 등록 — language를 ref로 추적해 최신 값 참조.
    const languageRef = useRef(language);
    useEffect(() => { languageRef.current = language; }, [language]);

    // 유저가 언어 셀렉터로 변경한 값을 localStorage에 저장 — 다음 실행에 우선 적용.
    useEffect(() => {
        try { localStorage.setItem('VL_LANGUAGE', language); } catch { /* privacy mode 등 */ }
    }, [language]);

    useEffect(() => {
        void invoke<string>('get_machine_id')
            .then((id) => setCurrentMachineId(id))
            .catch(() => setCurrentMachineId(null));
    }, []);

    const isWithinOfflineGrace = (lastVerifyAt: string | null) => {
        if (!lastVerifyAt) return false;
        const last = new Date(lastVerifyAt).getTime();
        if (!Number.isFinite(last)) return false;
        const elapsedMs = Date.now() - last;
        return elapsedMs <= PAID_OFFLINE_GRACE_HOURS * 60 * 60 * 1000;
    };

    // Initial Activation Check (re-validate with server if stored key exists)
    useEffect(() => {
        const bootstrap = async () => {
            const storedActivated = localStorage.getItem('VL_ACTIVATED');
            const storedLicenseKey = localStorage.getItem('VL_LICENSE_KEY');
            const lastVerifyAt = localStorage.getItem('VL_LAST_VERIFY_AT');

            if (storedActivated === 'true' && storedLicenseKey) {
                try {
                    const machineId = await invoke<string>('get_machine_id');
                    const { data, error } = await supabase.functions.invoke('verify-license', {
                        body: { licenseKey: storedLicenseKey, deviceId: machineId },
                    });

                    if (!error && data?.success) {
                        setIsActivated(true);
                        localStorage.setItem('VL_LAST_VERIFY_AT', new Date().toISOString());
                        setIsLicensingReady(true);
                        return;
                    }

                    // If server is reachable and says invalid/expired/locked, deny access immediately.
                    if (!error && data?.success === false) {
                        localStorage.removeItem('VL_ACTIVATED');
                        localStorage.removeItem('VL_LICENSE_KEY');
                        localStorage.removeItem('VL_LAST_VERIFY_AT');
                        setIsActivated(false);
                        setTimeout(() => setShowActivation(true), 500);
                        setIsLicensingReady(true);
                        return;
                    }

                    // Connectivity/server issue: allow temporary paid offline grace.
                    if (isWithinOfflineGrace(lastVerifyAt)) {
                        setIsActivated(true);
                        setIsLicensingReady(true);
                        return;
                    }
                } catch (err) {
                    console.error('Silent license re-validation failed:', err);
                    if (isWithinOfflineGrace(lastVerifyAt)) {
                        setIsActivated(true);
                        setIsLicensingReady(true);
                        return;
                    }
                }
            }

            localStorage.removeItem('VL_ACTIVATED');
            localStorage.removeItem('VL_LICENSE_KEY');
            localStorage.removeItem('VL_LAST_VERIFY_AT');
            setIsActivated(false);
            setTimeout(() => setShowActivation(true), 500);
            setIsLicensingReady(true);
        };

        void bootstrap();
    }, []);

    // Velo 계정 세션 초기 로드 + 상태 변경 실시간 반영.
    // 로그인 시 user_devices 등록 + 60초 heartbeat 시작. 로그아웃 시 heartbeat 정지 (row 유지).
    useEffect(() => {
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

        const handleSessionChange = (newSession: Session | null) => {
            setSession(newSession);
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
            if (newSession?.user?.id) {
                const userId = newSession.user.id;
                // registerDesktopDevice가 이미 last_seen_at 갱신 — 직후의 별도 heartbeat 호출은 중복.
                // 1초 후 첫 갱신은 timer로 양도해 즉각적인 Supabase 왕복 부하 줄임.
                void registerDesktopDevice(userId);
                heartbeatTimer = startHeartbeat(userId);
            }
        };

        supabase.auth.getSession().then(({ data }) => handleSessionChange(data.session));
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, s) => handleSessionChange(s));

        return () => {
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            subscription.unsubscribe();
        };
    }, []);

    // 앱 시작 시 SQLite DB에서 받은 파일 이력 로드 (앱 재시작해도 유지).
    // 이후 실시간 수신 이벤트로 prepend.
    useEffect(() => {
        let unlisten: (() => void) | undefined;
        (async () => {
            try {
                const initial = await invoke<ReceivedFile[]>('list_received_files', { limit: 200 });
                setReceivedFiles(initial);
            } catch (err) {
                console.warn('[velo] list_received_files failed', err);
            }
            try {
                const { listen } = await import('@tauri-apps/api/event');
                unlisten = await listen<ReceivedFile>('velo://file-received', (e) => {
                    const payload = e.payload;
                    setReceivedFiles((prev) => {
                        // 같은 hash 중복 제거 후 최신을 맨 앞에
                        const filtered = prev.filter((f) => f.contentHash !== payload.contentHash);
                        return [payload, ...filtered].slice(0, 200);
                    });
                    pushToast({
                        title: payload.fileName,
                        subtitle:
                            (languageRef.current === 'ko' ? '수신 완료' : 'Received') +
                            (payload.fromMdnsName ? ` · ${payload.fromMdnsName}` : ''),
                        onClick: () => setShowReceived(true),
                    });
                });
            } catch {
                // Tauri event API 미로드 — dev/web 환경. 무시.
            }
        })();
        return () => { if (unlisten) unlisten(); };
    }, []);

    // 데스크탑 HTTP 서버 기동 + saveDir 캐시. 로그인 여부와 무관하게 수신은 동작.
    // (로그인 없이 테스트 중일 땐 user_devices 등록은 안 되지만 포트·저장 경로는 필요.)
    useEffect(() => {
        void invoke<{ port: number; local_ip: string; save_dir: string; mdns_name: string | null }>(
            'start_sync_server'
        )
            .then((info) => setSaveDir(info.save_dir))
            .catch((err) => console.warn('[sync] start_sync_server failed', err));
    }, []);

    // OAuth deep link 수신 (velo://auth-callback#access_token=...) — 브라우저에서 구글/애플 로그인
    // 완료 시 Supabase가 우리 앱으로 리다이렉트. URL fragment에서 토큰 추출 → 세션 주입.
    // setSession은 Supabase 서버 검증으로 1~2초 걸리므로 토큰 받자마자 LoginModal 즉시 닫아 체감 지연 감소.
    useEffect(() => {
        let unlisten: (() => void) | undefined;
        (async () => {
            try {
                const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
                unlisten = await onOpenUrl((urls) => {
                    for (const url of urls) {
                        const idx = url.indexOf('#');
                        if (idx < 0) continue;
                        const fragment = url.slice(idx + 1);
                        const params = new URLSearchParams(fragment);
                        const accessToken = params.get('access_token');
                        const refreshToken = params.get('refresh_token');
                        if (accessToken && refreshToken) {
                            // 토큰 받은 즉시 모달 닫음 — UI는 setSession 완료 기다리지 않고 빠른 전환.
                            // 세션은 onAuthStateChange가 백그라운드에서 처리.
                            setShowLogin(false);
                            void supabase.auth.setSession({
                                access_token: accessToken,
                                refresh_token: refreshToken,
                            });
                        }
                    }
                });
            } catch {
                // deep link 플러그인 로드 실패 — dev 환경이거나 플러그인 미등록. 무시.
            }
        })();
        return () => { if (unlisten) unlisten(); };
    }, []);

    useEffect(() => {
        const normalize = (v: string) => v.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
        const isNewer = (latest: string, current: string) => {
            const a = normalize(latest);
            const b = normalize(current);
            const len = Math.max(a.length, b.length);
            for (let i = 0; i < len; i++) {
                const av = a[i] ?? 0;
                const bv = b[i] ?? 0;
                if (av > bv) return true;
                if (av < bv) return false;
            }
            return false;
        };

        const checkUpdate = async () => {
            try {
                const currentVersion = await getVersion();
                const res = await fetch(APP_UPDATE_META_URL, { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json();
                const latestVersion = String(data?.version ?? '').trim();
                const downloadUrl = String(data?.downloadUrl ?? 'https://velo.smileon.app').trim();
                if (!latestVersion) return;

                if (isNewer(latestVersion, currentVersion)) {
                    setUpdateInfo({ latestVersion, downloadUrl });
                }
            } catch {
                // Ignore update check errors.
            }
        };

        void checkUpdate();
    }, []);

    const [files, setFiles] = useState<VideoFile[]>([]);
    const [settings, setSettings] = useState<CompressionSettings>({
        format: 'MP4',
        resolution: 'Original',
        lockAspectRatio: true,
        compressionLevel: 6, // Balanced default
        removeAudio: false,
        moveToTrash: false,
        subjectiveVQ: true, // Always ON (Magic Quality)
        enableHDR: false,
        enableDeshake: false, // Removed feature
        cleanMetadata: false, // Default to OFF (Keep metadata)
        enableTurbo: false,
        parallelLimit: 2,
        enableWatermark: false, // Removed feature
        watermarkText: undefined,
        enableThumbnail: false, // Removed feature
        outputMode: 'Same',
        customOutputPath: undefined,
        useHighEfficiencyCodec: false, // Default to FALSE (VP9 Safe)
        imageFormat: 'JPG',
        imageQuality: 80,
    });

    const [isProcessing, setIsProcessing] = useState(false);
    const [currentFileId, setCurrentFileId] = useState<string | null>(null);
    const [totalProgress, setTotalProgress] = useState(0);
    const [showLegal, setShowLegal] = useState(false);
    const [freeQuotaState, setFreeQuotaState] = useState<{
        checking: boolean;
        allowed: boolean | null;
        remaining: number | null;
        resetAt: string | null;
        reason: string | null;
    }>({
        checking: false,
        allowed: null,
        remaining: null,
        resetAt: null,
        reason: null,
    });

    const stopFnsRef = useRef<Map<string, () => void>>(new Map());
    const activeIdsRef = useRef<Set<string>>(new Set());
    const storedLicenseKey = localStorage.getItem('VL_LICENSE_KEY');

    // 압축 세션 — "압축 시작" 눌렸을 때 생성, 전부 끝나면 종료. DB에 집계 기록.
    const currentSessionIdRef = useRef<string | null>(null);
    const wasProcessingRef = useRef<boolean>(false);

    // --- Theme Effect ---
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    // --- Handlers ---
    const addFiles = useCallback(async (paths: string[]) => {
        if (isProcessing) return;
        const acceptedPaths = paths.filter(isAcceptedPath);
        if (acceptedPaths.length === 0) return;

        const newFilesPromises = acceptedPaths.map(async (path) => {
            const name = path.split(/[\\/]/).pop() || 'Unknown';
            const info = await getFileInfo(path);
            return {
                id: crypto.randomUUID(),
                path: path,
                name: name,
                status: 'queued',
                originalSize: info.size,
                progress: 0
            } as VideoFile;
        });
        const newFiles = await Promise.all(newFilesPromises);
        setFiles(prev => [...prev, ...newFiles]);
    }, [isProcessing, processingMode]);

    // Drag/Drop 리스너는 scanAndLoadFolder 등 폴더 핸들러 선언 후로 이동 (아래 참조).

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleBrowse = useCallback(async () => {
        if (isProcessing) return;
        try {
            const selected = await open({
                multiple: true,
                filters: [{
                    name: processingMode === 'video' ? 'Video' : 'Image',
                    extensions: processingMode === 'video'
                        ? ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv', 'flv', 'mpeg', 'mpg']
                        : ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif']
                }]
            });
            if (selected) {
                const paths = Array.isArray(selected) ? selected : (selected === null ? [] : [selected]);
                addFiles(paths);
            }
        } catch (err) {
            console.error('Failed to open file dialog:', err);
        }
    }, [isProcessing, addFiles, processingMode]);

    const handleChangeProcessingMode = useCallback((mode: 'video' | 'image') => {
        if (isProcessing || processingMode === mode) return;
        setProcessingMode(mode);
        setFiles([]);
        setTotalProgress(0);
        setCurrentFileId(null);
    }, [isProcessing, processingMode]);

    const handleLicenseButtonClick = useCallback(() => {
        if (isActivated) {
            setShowLicenseStatus(true);
            return;
        }
        setShowActivation(true);
    }, [isActivated]);

    const handleRemove = useCallback((id: string) => {
        if (isProcessing) return;
        setFiles(prev => prev.filter(f => f.id !== id));
    }, [isProcessing]);

    const handleClearAll = useCallback(() => {
        if (isProcessing) return;
        setFiles([]);
    }, [isProcessing]);

    const updateSettings = useCallback((partial: Partial<CompressionSettings>) => {
        setSettings(prev => ({ ...prev, ...partial }));
    }, []);

    const handleOpenFolder = useCallback((path: string) => {
        invoke('show_in_folder', { path });
    }, []);

    // --- 폴더 모드 ---

    // 스캔 결과를 VideoFile 리스트로 변환. 출력 경로는 루트 기준 트리 구조 유지:
    //   {rootPath}/_velo_compressed/{상대 폴더}/{파일명}.{ext}
    // 출력 확장자는 processingMode·settings에 따라 결정되는데, 폴더엔 video/image 혼재할 수 있어
    // 파일별 media_type을 보고 개별 결정.
    const folderScanToFiles = useCallback((scanData: {
        rootPath: string;
        files: Array<{ path: string; fileName: string; size: number; mediaType: string; relativePath: string }>;
    }): VideoFile[] => {
        const videoExt = settings.format.toLowerCase();
        const imageExt = settings.imageFormat.toLowerCase();
        const compressedRoot = `${scanData.rootPath}/_velo_compressed`;
        return scanData.files.map((sf) => {
            const stem = sf.fileName.includes('.')
                ? sf.fileName.slice(0, sf.fileName.lastIndexOf('.'))
                : sf.fileName;
            const lastSlash = sf.relativePath.lastIndexOf('/');
            const relDir = lastSlash < 0 ? '' : sf.relativePath.slice(0, lastSlash);
            const outDir = relDir ? `${compressedRoot}/${relDir}` : compressedRoot;
            const ext = sf.mediaType === 'image' ? imageExt : videoExt;
            return {
                id: crypto.randomUUID(),
                path: sf.path,
                name: sf.fileName,
                status: 'queued',
                originalSize: sf.size,
                progress: 0,
                outputPath: `${outDir}/${stem}.${ext}`,
                mediaType: sf.mediaType === 'image' ? 'image' : 'video',
            } as VideoFile;
        });
    }, [settings.format, settings.imageFormat]);

    const scanAndLoadFolder = useCallback(async (rootPath: string) => {
        if (isProcessing) return;
        try {
            const result = await invoke<{
                rootPath: string;
                totalCount: number;
                totalBytes: number;
                videoCount: number;
                imageCount: number;
                files: Array<{ path: string; fileName: string; size: number; mediaType: string; relativePath: string }>;
            }>('scan_folder_media', { rootPath });
            setFolderScan({
                rootPath: result.rootPath,
                totalCount: result.totalCount,
                totalBytes: result.totalBytes,
                videoCount: result.videoCount,
                imageCount: result.imageCount,
            });
            setFiles(folderScanToFiles(result));
        } catch (err) {
            console.warn('[folder] scan failed', err);
        }
    }, [isProcessing, folderScanToFiles]);

    const handlePickFolder = useCallback(async () => {
        try {
            const selected = await open({ directory: true, multiple: false });
            if (!selected || typeof selected !== 'string') return;
            await scanAndLoadFolder(selected);
        } catch (err) {
            console.warn('[folder] pick dialog failed', err);
        }
    }, [scanAndLoadFolder]);

    const handleResetFolder = useCallback(() => {
        if (isProcessing) return;
        setFolderScan(null);
        setFiles([]);
        setTotalProgress(0);
        setCurrentFileId(null);
    }, [isProcessing]);

    // Native Drag and Drop — 파일 모드는 addFiles, 폴더 모드는 첫 디렉토리 스캔.
    useEffect(() => {
        const unlistenPromise = getCurrentWebviewWindow().onDragDropEvent(async (event) => {
            if (event.payload.type !== 'drop') return;
            const paths = event.payload.paths;
            if (inputMode === 'folder') {
                for (const p of paths) {
                    try {
                        await scanAndLoadFolder(p);
                        return;
                    } catch {
                        // 디렉토리 아니면 다음 경로 시도
                    }
                }
                console.warn('[folder] dropped paths contained no valid directory');
                return;
            }
            addFiles(paths);
        });
        return () => { unlistenPromise.then(unlisten => unlisten()); };
    }, [addFiles, inputMode, scanAndLoadFolder]);

    // --- Processing Logic ---
    const processFile = async (file: VideoFile) => {
        activeIdsRef.current.add(file.id);
        const nextId = Array.from(activeIdsRef.current)[0] || null;
        setCurrentFileId(nextId);

        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'processing', progress: 0 } : f));

        // catch block에서도 참조할 수 있도록 try 밖에서 계산.
        const fileMediaType: 'video' | 'image' = file.mediaType ?? processingMode;
        const videoFormat = settings.format;
        const imageFormat = settings.imageFormat;
        const ext = (fileMediaType === 'image' ? imageFormat : videoFormat).toLowerCase();

        try {
            const path = file.path;
            const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
            const dir = path.substring(0, lastSlash);
            const filenameWithExt = path.substring(lastSlash + 1);
            const lastDot = filenameWithExt.lastIndexOf('.');
            const filename = lastDot !== -1 ? filenameWithExt.substring(0, lastDot) : filenameWithExt;

            const resolutionSuffix = fileMediaType === 'image'
                ? ''
                : (settings.resolution === 'Original' ? '' : `_${settings.resolution}`);

            let outDir = dir;
            if (settings.outputMode === 'Custom' && settings.customOutputPath) {
                outDir = settings.customOutputPath;
            }

            // 폴더 모드는 folderScanToFiles에서 미리 계산된 outputPath를 그대로 사용.
            // 출력 경로의 부모 디렉토리는 여기서 보장 (FFmpeg는 자동 mkdir 안 함).
            const outputPath = file.outputPath ?? `${outDir}/${filename}_compressed${resolutionSuffix}.${ext}`;
            const outParentSep = Math.max(outputPath.lastIndexOf('/'), outputPath.lastIndexOf('\\'));
            if (outParentSep > 0) {
                const outParent = outputPath.substring(0, outParentSep);
                try { await invoke('ensure_dir', { path: outParent }); } catch (e) { console.warn('[ensure_dir]', e); }
            }

            // 재실행 skip 룰 — 출력 파일 이미 존재하면 압축 건너뛰고 완료 처리.
            // 특히 폴더 모드에서 같은 폴더를 다시 드롭했을 때 이중 처리 방지.
            const alreadyExists = await invoke<boolean>('file_exists', { path: outputPath }).catch(() => false);
            if (alreadyExists) {
                const existingInfo = await getFileInfo(outputPath).catch(() => ({ size: 0 }));
                setFiles(prev => prev.map(f => f.id === file.id ? {
                    ...f,
                    status: 'completed',
                    progress: 100,
                    outputPath,
                    compressedSize: existingInfo.size,
                    skipped: true,
                } : f));
                const sid = currentSessionIdRef.current;
                if (sid) {
                    invoke('compress_record_insert', {
                        record: {
                            id: file.id,
                            sessionId: sid,
                            fileName: file.name,
                            inputPath: file.path,
                            outputPath,
                            mediaType: fileMediaType,
                            format: ext,
                            originalSize: file.originalSize,
                            compressedSize: existingInfo.size,
                            skipped: true,
                            skipReason: 'already_compressed',
                            errorMessage: null,
                            completedAtMs: Date.now(),
                        },
                    }).catch(e => console.warn('[compress_record_insert/skip]', e));
                }
                return; // compressVideo/Image 호출 없이 종료 — finally block은 정상 실행.
            }

            const task = fileMediaType === 'video'
                ? compressVideo(
                    file.path,
                    outputPath,
                    { ...settings, format: videoFormat },
                    (progress) => {
                        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, progress: progress.percent } : f));
                    }
                )
                : compressImage(
                    file.path,
                    outputPath,
                    imageFormat,
                    settings.imageQuality,
                    () => {
                        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, progress: 100 } : f));
                    }
                );

            const { promise, stop } = task;

            stopFnsRef.current.set(file.id, stop);
            await promise;

            const outputInfo = await getFileInfo(outputPath);

            if (settings.moveToTrash) {
                try {
                    await invoke('move_to_trash', { path: file.path });
                } catch (e) {
                    console.error('Failed to move original file to trash:', e);
                }
            }

            setFiles(prev => prev.map(f => f.id === file.id ? {
                ...f,
                status: 'completed',
                progress: 100,
                compressedSize: outputInfo.size,
                outputPath: outputPath
            } : f));

            // 세션 DB에 성공 record 기록. 실패해도 압축 자체는 성공이라 로그만.
            const sid = currentSessionIdRef.current;
            if (sid) {
                invoke('compress_record_insert', {
                    record: {
                        id: file.id,
                        sessionId: sid,
                        fileName: file.name,
                        inputPath: file.path,
                        outputPath,
                        mediaType: fileMediaType,
                        format: ext,
                        originalSize: file.originalSize,
                        compressedSize: outputInfo.size,
                        skipped: false,
                        skipReason: null,
                        errorMessage: null,
                        completedAtMs: Date.now(),
                    },
                }).catch(e => console.warn('[compress_record_insert]', e));
            }
        } catch (error: any) {
            if (error.message === 'STOPPED') {
                setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'queued', progress: 0 } : f));
            } else {
                console.error(`Error processing file ${file.name}: `, error);
                setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'error', progress: 0 } : f));
                // 실패 기록 — error_message 포함.
                const sid = currentSessionIdRef.current;
                if (sid) {
                    invoke('compress_record_insert', {
                        record: {
                            id: file.id,
                            sessionId: sid,
                            fileName: file.name,
                            inputPath: file.path,
                            outputPath: null,
                            mediaType: fileMediaType,
                            format: ext,
                            originalSize: file.originalSize,
                            compressedSize: 0,
                            skipped: false,
                            skipReason: null,
                            errorMessage: String(error?.message ?? error),
                            completedAtMs: Date.now(),
                        },
                    }).catch(e => console.warn('[compress_record_insert/error]', e));
                }
            }
        } finally {
            activeIdsRef.current.delete(file.id);
            stopFnsRef.current.delete(file.id);
            const nextId = Array.from(activeIdsRef.current)[0] || null;
            setCurrentFileId(nextId);

            // Check if all done
            setFiles(currentFiles => {
                const total = currentFiles.length;
                const done = currentFiles.filter(f => f.status === 'completed' || f.status === 'error').length;
                setTotalProgress(total > 0 ? (done / total) * 100 : 0);

                if (done === total && isProcessing) {
                    setIsProcessing(false);
                }
                return currentFiles;
            });
        }
    };

    // 세션 종료 감지 — isProcessing true→false 전환 시 DB에 집계 기록 + 완료 Toast.
    useEffect(() => {
        if (wasProcessingRef.current && !isProcessing) {
            const sid = currentSessionIdRef.current;
            if (sid) {
                // done = 실제 압축 성공 (skipped 제외), skipped = 이미 출력 있어서 건너뜀.
                const skipped = files.filter(f => f.skipped === true).length;
                const done = files.filter(f => f.status === 'completed' && !f.skipped).length;
                const failed = files.filter(f => f.status === 'error').length;
                const sumOriginal = files.reduce((a, f) => a + (f.originalSize ?? 0), 0);
                const sumCompressed = files.reduce((a, f) => a + (f.compressedSize ?? 0), 0);
                invoke('compress_session_end', {
                    sessionId: sid,
                    doneCount: done,
                    failedCount: failed,
                    skippedCount: skipped,
                    totalOriginal: sumOriginal,
                    totalCompressed: sumCompressed,
                }).catch(e => console.warn('[compress_session_end]', e));
                currentSessionIdRef.current = null;

                // 완료 Toast — 0건이면 생략 (취소 상태).
                if (done + skipped + failed > 0) {
                    const savedBytes = Math.max(0, sumOriginal - sumCompressed);
                    const savedPercent = sumOriginal > 0
                        ? Math.round((savedBytes / sumOriginal) * 100)
                        : 0;
                    const parts: string[] = [];
                    if (done > 0) parts.push(languageRef.current === 'ko' ? `${done}개 완료` : `${done} done`);
                    if (skipped > 0) parts.push(languageRef.current === 'ko' ? `${skipped}개 건너뜀` : `${skipped} skipped`);
                    if (failed > 0) parts.push(languageRef.current === 'ko' ? `${failed}개 실패` : `${failed} failed`);
                    const subtitle = savedBytes > 0
                        ? `${parts.join(' · ')} · ${formatBytesShort(savedBytes)} ${languageRef.current === 'ko' ? '절감' : 'saved'} (${savedPercent}%)`
                        : parts.join(' · ');
                    pushToast({
                        title: languageRef.current === 'ko' ? '압축 완료' : 'Compression done',
                        subtitle,
                    });
                }
            }
        }
        wasProcessingRef.current = isProcessing;
    }, [isProcessing, files, pushToast]);

    // Auto-spawn tasks
    useEffect(() => {
        if (!isProcessing) return;

        const queued = files.filter(f => f.status === 'queued' && !activeIdsRef.current.has(f.id));
        const activeCount = activeIdsRef.current.size;
        const canSpawn = settings.parallelLimit - activeCount;

        if (canSpawn > 0 && queued.length > 0) {
            queued.slice(0, canSpawn).forEach(file => {
                processFile(file);
            });
        }

        if (activeCount === 0 && queued.length === 0) {
            setIsProcessing(false);
        }
    }, [isProcessing, files, settings.parallelLimit]);

    const getRequestedFiles = useCallback(() => {
        const queuedCount = files.filter(f => f.status === 'queued').length;
        const allDone = files.length > 0 && files.every(f => f.status === 'completed');
        return queuedCount > 0 ? queuedCount : (allDone ? files.length : 0);
    }, [files]);

    useEffect(() => {
        const checkFreeQuota = async () => {
            if (isActivated || isProcessing) return;
            const requestedFiles = getRequestedFiles();
            if (requestedFiles <= 0) {
                setFreeQuotaState({
                    checking: false,
                    allowed: null,
                    remaining: null,
                    resetAt: null,
                    reason: null,
                });
                return;
            }

            setFreeQuotaState(prev => ({ ...prev, checking: true }));
            try {
                const machineId = await invoke<string>('get_machine_id');
                const { data, error } = await supabase.functions.invoke('check-free-quota', {
                    body: { deviceId: machineId, requestedFiles, commit: false, mediaType: processingMode }
                });

                if (error) {
                    setFreeQuotaState({
                        checking: false,
                        allowed: false,
                        remaining: null,
                        resetAt: null,
                        reason: 'OFFLINE_OR_SERVER',
                    });
                    return;
                }

                if (data?.isPaid) {
                    setIsActivated(true);
                    setFreeQuotaState({
                        checking: false,
                        allowed: null,
                        remaining: null,
                        resetAt: null,
                        reason: null,
                    });
                    return;
                }

                setFreeQuotaState({
                    checking: false,
                    allowed: Boolean(data?.allowed),
                    remaining: typeof data?.remaining === 'number' ? data.remaining : null,
                    resetAt: data?.resetAt ?? null,
                    reason: data?.reason ?? null,
                });
            } catch {
                setFreeQuotaState({
                    checking: false,
                    allowed: false,
                    remaining: null,
                    resetAt: null,
                    reason: 'OFFLINE_OR_SERVER',
                });
            }
        };

        void checkFreeQuota();
    }, [isActivated, isProcessing, getRequestedFiles, processingMode]);

    const startCompression = useCallback(async () => {
        if (!isActivated) {
            const requestedFiles = getRequestedFiles();
            if (requestedFiles <= 0) {
                return;
            }
            if (freeQuotaState.checking) {
                return;
            }

            try {
                const machineId = await invoke<string>('get_machine_id');
                const { data, error } = await supabase.functions.invoke('check-free-quota', {
                    body: { deviceId: machineId, requestedFiles, commit: true, mediaType: processingMode }
                });

                if (error || !data?.allowed) {
                    setFreeQuotaState({
                        checking: false,
                        allowed: false,
                        remaining: typeof data?.remaining === 'number' ? data.remaining : null,
                        resetAt: data?.resetAt ?? null,
                        reason: data?.reason ?? 'OFFLINE_OR_SERVER',
                    });
                    return;
                }

                if (data?.isPaid) {
                    setIsActivated(true);
                    setFreeQuotaState({
                        checking: false,
                        allowed: null,
                        remaining: null,
                        resetAt: null,
                        reason: null,
                    });
                } else {
                    setFreeQuotaState({
                        checking: false,
                        allowed: true,
                        remaining: typeof data?.remaining === 'number' ? data.remaining : null,
                        resetAt: data?.resetAt ?? null,
                        reason: null,
                    });
                }
            } catch {
                setFreeQuotaState({
                    checking: false,
                    allowed: false,
                    remaining: null,
                    resetAt: null,
                    reason: 'OFFLINE_OR_SERVER',
                });
                return;
            }
        }

        if (isProcessing) {
            // Stop everything
            stopFnsRef.current.forEach(stop => stop());
            stopFnsRef.current.clear();
            activeIdsRef.current.clear();
            setIsProcessing(false);
            return;
        }

        const hasQueued = files.some(f => f.status === 'queued');
        const allDone = files.length > 0 && files.every(f => f.status === 'completed');

        if (!hasQueued && allDone) {
            setFiles(prev => prev.map(f => ({ ...f, status: 'queued', progress: 0 })));
        }

        // 세션 시작 — 이번 batch의 unique id + 타입·루트 폴더 기록.
        const sessionId = crypto.randomUUID();
        currentSessionIdRef.current = sessionId;
        const queuedCount = files.filter(f => f.status === 'queued' || f.status === 'completed').length;
        invoke('compress_session_start', {
            sessionId,
            sessionType: inputMode,
            rootPath: inputMode === 'folder' ? (folderScan?.rootPath ?? null) : null,
            totalCount: queuedCount,
        }).catch(e => console.warn('[compress_session_start]', e));

        setIsProcessing(true);
        setTotalProgress(0);
    }, [files, isProcessing, isActivated, getRequestedFiles, freeQuotaState.checking, processingMode, settings, inputMode, folderScan]);

    const startDisabled = isProcessing
        ? false
        : !isActivated && (
            freeQuotaState.checking ||
            freeQuotaState.allowed === false
        );

    const freeStatusMessage = (() => {
        const dailyLimit = processingMode === 'image' ? 20 : 3;
        if (isActivated) return null;
        if (freeQuotaState.checking) {
            return language === 'ko'
                ? '\uBB34\uB8CC \uD50C\uB79C \uC0AC\uC6A9 \uAC00\uB2A5 \uC5EC\uBD80\uB97C \uD655\uC778 \uC911\uC785\uB2C8\uB2E4...'
                : 'Checking free-plan availability...';
        }
        if (freeQuotaState.allowed === false) {
            if (freeQuotaState.reason === 'FREE_LIMIT_REACHED') {
                const resetText = freeQuotaState.resetAt ? new Date(freeQuotaState.resetAt).toLocaleString() : '-';
                const remain = typeof freeQuotaState.remaining === 'number' ? freeQuotaState.remaining : 0;
                return language === 'ko'
                    ? `\uBB34\uB8CC \uD50C\uB79C \uC624\uB298 \uB0A8\uC740 \uD69F\uC218: ${remain}/${dailyLimit} (\uD55C\uB3C4 \uB3C4\uB2EC) · \uB2E4\uC74C \uCD08\uAE30\uD654: ${resetText}`
                    : `Free mode remaining today: ${remain}/${dailyLimit} (limit reached) · Next reset: ${resetText}`;
            }
            return language === 'ko'
                ? '\uBB34\uB8CC \uD50C\uB79C\uC740 \uC628\uB77C\uC778 \uC5F0\uACB0\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.'
                : 'Free mode requires an online connection.';
        }
        if (freeQuotaState.allowed === true) {
            const remain = typeof freeQuotaState.remaining === 'number' ? freeQuotaState.remaining : 0;
            return language === 'ko'
                ? `\uBB34\uB8CC \uD50C\uB79C \uC624\uB298 \uB0A8\uC740 \uD69F\uC218: ${remain}/${dailyLimit}`
                : `Free mode remaining today: ${remain}/${dailyLimit}`;
        }
        return null;
    })();

    return (
        <div className="flex flex-col h-screen w-screen bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300 overflow-hidden">
            <Header
                theme={theme}
                setTheme={setTheme}
                language={language}
                setLanguage={setLanguage}
                session={session}
                onLoginClick={() => setShowLogin(true)}
                onLogoutClick={async () => { await supabase.auth.signOut(); }}
                onDevicesClick={() => setShowDevices(true)}
                onReceivedClick={() => setShowReceived(true)}
                receivedCount={receivedFiles.length}
            />
            {updateInfo && (
                <div className="mx-4 mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                    <div className="flex items-center justify-between gap-3">
                        <span>
                            {TRANSLATIONS[language].updateAvailable} (v{updateInfo.latestVersion})
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                            <a
                                href={updateInfo.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
                            >
                                {TRANSLATIONS[language].updateButton}
                            </a>
                            <button
                                onClick={() => setUpdateInfo(null)}
                                className="rounded-lg border border-blue-300 px-3 py-1.5 text-[11px] font-bold hover:bg-blue-100 dark:border-blue-800 dark:hover:bg-blue-900/40"
                            >
                                {TRANSLATIONS[language].dismissButton}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* 입력 방식 탭 — 개별(파일/드래그) ↔ 폴더(폴더 단위 일괄). 압축 중엔 전환 잠금. */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 bg-gray-50 dark:bg-slate-900/40 border-b border-gray-200 dark:border-slate-800">
                <button
                    onClick={() => { if (!isProcessing) setInputMode('file'); }}
                    disabled={isProcessing}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${inputMode === 'file'
                            ? 'bg-primary-500 text-white shadow-sm'
                            : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50'
                        }`}
                >
                    <FileText size={14} />
                    {TRANSLATIONS[language].individualMode}
                </button>
                <button
                    onClick={() => { if (!isProcessing) setInputMode('folder'); }}
                    disabled={isProcessing}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${inputMode === 'folder'
                            ? 'bg-primary-500 text-white shadow-sm'
                            : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50'
                        }`}
                >
                    <FolderIcon size={14} />
                    {TRANSLATIONS[language].folderMode}
                </button>
            </div>

            <main className="flex-1 flex overflow-hidden">
                <div className="w-full lg:w-3/5 border-r border-gray-200 dark:border-slate-800 h-full flex flex-col">
                    {inputMode === 'file' ? (
                        <Sidebar
                            files={files}
                            onDrop={handleDrop}
                            onBrowse={handleBrowse}
                            onRemove={handleRemove}
                            onClearAll={handleClearAll}
                            onOpenFolder={handleOpenFolder}
                            t={TRANSLATIONS[language]}
                            language={language}
                            processingMode={processingMode}
                            freePlanMessage={freeStatusMessage}
                        />
                    ) : (
                        <FolderSidebar
                            scan={folderScan}
                            files={files}
                            isProcessing={isProcessing}
                            language={language}
                            onPickFolder={handlePickFolder}
                            onDropFolder={scanAndLoadFolder}
                            onReset={handleResetFolder}
                            onRemoveFile={handleRemove}
                        />
                    )}
                </div>
                <div className="hidden lg:flex lg:w-2/5 h-full flex-col">
                    <SettingsPanel
                        processingMode={processingMode}
                        onChangeProcessingMode={handleChangeProcessingMode}
                        language={language}
                        settings={settings}
                        updateSettings={updateSettings}
                        t={TRANSLATIONS[language]}
                        isProcessing={isProcessing}
                        filesCount={files.length}
                        totalSize={files.reduce((acc, f) => acc + f.originalSize, 0)}
                        onOpenLegal={() => setShowLegal(true)}
                    />
                </div>
            </main>
            <BottomBar
                onStart={startCompression}
                isProcessing={isProcessing}
                totalProgress={totalProgress}
                currentFileId={currentFileId}
                files={files}
                t={TRANSLATIONS[language]}
                startDisabled={startDisabled}
                statusMessage={null}
            />

            <LegalModal
                isOpen={showLegal}
                onClose={() => setShowLegal(false)}
                t={TRANSLATIONS[language]}
                language={language}
            />

            <LicenseStatusModal
                isOpen={showLicenseStatus}
                onClose={() => setShowLicenseStatus(false)}
                language={language}
                isDark={theme === 'dark'}
                storedLicenseKey={storedLicenseKey}
            />
            {/* 테스트 기간 — 로그인 없이도 진입 가능. Header의 "Velo 로그인" 버튼 눌렀을 때만 모달 표시. */}
            <LoginModal
                isOpen={showLogin}
                onClose={() => setShowLogin(false)}
                language={language}
                forced={false}
            />
            <DeviceManagerModal
                isOpen={showDevices}
                onClose={() => setShowDevices(false)}
                userId={session?.user?.id ?? null}
                language={language}
                currentMachineId={currentMachineId}
            />
            <ReceivedFilesModal
                isOpen={showReceived}
                onClose={() => setShowReceived(false)}
                files={receivedFiles}
                saveDir={saveDir}
                language={language}
                onFileDeleted={(hash) =>
                    setReceivedFiles((prev) => prev.filter((f) => f.contentHash !== hash))
                }
                onSaveDirChangeQueued={(newPath) => {
                    pushToast({
                        title:
                            languageRef.current === 'ko'
                                ? '저장 폴더 변경 예약됨'
                                : 'Save folder change queued',
                        subtitle:
                            languageRef.current === 'ko'
                                ? `다음 실행부터 적용됩니다\n${newPath}`
                                : `Applies from next launch\n${newPath}`,
                    });
                }}
            />
            <ToastStack toasts={toasts} onDismiss={dismissToast} />
        </div>
    );
};

export default App;
