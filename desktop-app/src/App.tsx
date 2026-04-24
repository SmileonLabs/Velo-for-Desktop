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
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';
import { registerDesktopDevice, startHeartbeat, touchDeviceHeartbeat } from './deviceRegistration';

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

    const isAcceptedPath = (path: string) => {
        return processingMode === 'video' ? isVideoPath(path) : isImagePath(path);
    };

    // --- State ---
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [language, setLanguage] = useState<Language>('ko');
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
                void registerDesktopDevice(userId);
                // 즉시 1회 + 이후 주기적 heartbeat. registerDesktopDevice 직후라 첫 1회는 과하지만
                // 등록 실패/지연 시에도 last_seen_at이 살아있도록 안전망.
                void touchDeviceHeartbeat(userId);
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

    // Native Drag and Drop Listener for Tauri v2
    useEffect(() => {
        const unlistenPromise = getCurrentWebviewWindow().onDragDropEvent((event) => {
            if (event.payload.type === 'drop') {
                const paths = event.payload.paths;
                addFiles(paths);
            }
        });

        return () => {
            unlistenPromise.then(unlisten => unlisten());
        };
    }, [addFiles]);

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

    // --- Processing Logic ---
    const processFile = async (file: VideoFile) => {
        activeIdsRef.current.add(file.id);
        const nextId = Array.from(activeIdsRef.current)[0] || null;
        setCurrentFileId(nextId);

        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'processing', progress: 0 } : f));

        try {
            const path = file.path;
            const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
            const dir = path.substring(0, lastSlash);
            const filenameWithExt = path.substring(lastSlash + 1);
            const lastDot = filenameWithExt.lastIndexOf('.');
            const filename = lastDot !== -1 ? filenameWithExt.substring(0, lastDot) : filenameWithExt;

            const videoFormat = settings.format;
            const imageFormat = settings.imageFormat;
            const ext = (processingMode === 'image' ? imageFormat : videoFormat).toLowerCase();
            const resolutionSuffix = processingMode === 'image'
                ? ''
                : (settings.resolution === 'Original' ? '' : `_${settings.resolution}`);

            let outDir = dir;
            if (settings.outputMode === 'Custom' && settings.customOutputPath) {
                outDir = settings.customOutputPath;
            }

            const outputPath = `${outDir}/${filename}_compressed${resolutionSuffix}.${ext}`;

            const task = processingMode === 'video'
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
        } catch (error: any) {
            if (error.message === 'STOPPED') {
                setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'queued', progress: 0 } : f));
            } else {
                console.error(`Error processing file ${file.name}: `, error);
                setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'error', progress: 0 } : f));
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

        setIsProcessing(true);
        setTotalProgress(0);
    }, [files, isProcessing, isActivated, getRequestedFiles, freeQuotaState.checking, processingMode, settings]);

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
                onLicenseButtonClick={handleLicenseButtonClick}
                isActivated={isActivated}
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
                            {language === 'ko'
                                ? `새 버전(${updateInfo.latestVersion})이 있습니다. 업데이트를 권장합니다.`
                                : `A new version (${updateInfo.latestVersion}) is available. Update is recommended.`}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                            <a
                                href={updateInfo.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
                            >
                                {language === 'ko' ? '업데이트' : 'Update'}
                            </a>
                            <button
                                onClick={() => setUpdateInfo(null)}
                                className="rounded-lg border border-blue-300 px-3 py-1.5 text-[11px] font-bold hover:bg-blue-100 dark:border-blue-800 dark:hover:bg-blue-900/40"
                            >
                                {language === 'ko' ? '닫기' : 'Dismiss'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <main className="flex-1 flex overflow-hidden">
                <div className="w-full lg:w-3/5 border-r border-gray-200 dark:border-slate-800 h-full flex flex-col">
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
