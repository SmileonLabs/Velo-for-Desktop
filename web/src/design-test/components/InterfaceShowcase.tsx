import React, { useEffect, useState, useRef } from 'react';
import {
    Video, Sun, Moon, Monitor, Info, Sliders,
    UploadCloud, FileVideo, Files, Trash2, FolderOpen,
    Wand2, Zap, ShieldCheck, VolumeX, Play,
    Loader2, X, CheckCircle2, Sparkles, Image as ImageIcon,
    Settings2, ExternalLink, ChevronDown
} from 'lucide-react';
import { useTranslation as useI18n } from 'react-i18next';
import { useTheme as useGlobalTheme } from '../../hooks/useTheme';

// --- Types ---
interface VideoFile {
    id: string;
    path: string;
    name: string;
    status: 'idle' | 'queued' | 'processing' | 'completed' | 'error';
    originalSize: number;
    compressedSize?: number;
    progress: number;
}

type ResolutionPreset = 'Original' | '4K' | '1080p' | '720p' | '480p' | 'Custom' | 'Instagram' | 'YouTube';

interface CompressionSettings {
    format: 'MP4' | 'WebM' | 'MKV' | 'GIF';
    resolution: ResolutionPreset;
    lockAspectRatio: boolean;
    compressionLevel: number;
    removeAudio: boolean;
    moveToTrash: boolean;
    subjectiveVQ: boolean;
    enableHDR: boolean;
    cleanMetadata: boolean;
    enableTurbo: boolean;
    parallelLimit: number;
    outputMode: 'Same' | 'Custom';
    useHighEfficiencyCodec: boolean;
    imageFormat: 'JPG' | 'PNG' | 'WEBP';
    imageQuality: number;
}

// --- Translations (Synced with desktop-app/constants.ts) ---
const TRANSLATIONS = {
    en: {
        dropText: "Drop your videos here to lighten",
        browse: "Browse Files",
        files: "File Queue",
        queued: "Queued",
        processing: "Processing...",
        completed: "Done",
        settings: "Basic Settings",
        advanced: "Advanced Settings",
        format: "Output Format",
        resolution: "Resolution",
        audio: "Audio Control",
        removeAudio: "Remove Audio (Mute)",
        fileMgmt: "File Management",
        moveToTrash: "Move original to trash after compression",
        start: "Start Compression",
        stop: "Stop",
        totalProgress: "Total Progress",
        eta: "ETA",
        remove: "Remove",
        clearAll: "Clear All",
        theme: "Theme",
        language: "Language",
        custom: "Custom",
        original: "Original",
        lockRatio: "Lock Ratio",
        quality: "Compression Quality",
        highQuality: "Quality",
        highCompression: "Compress",
        instagram: "Instagram (1080p)",
        youtube: "YouTube (4K)",
        originalSizeText: "Original Size",
        estResultText: "Est. Result",
        estReductionText: "Est. Batch Reduction",
        reductionOff: "OFF",
        batchNote: "Advanced SVT-AV1 scaling applied to {count} files",
        outputDest: "Saving Location",
        sameAsOriginal: "Same as original folder",
        selectFolder: "Select destination folder",
        saveTo: "Save to",
        legal: "Terms & Privacy",
        buyNow: "Don't have a key? Buy one now",
        turbo: "Turbo Acceleration Mode",
        turboTip: "Enables hardware acceleration and optimized SVT-AV1 presets for up to 3x faster compression.",
        parallel: "Parallel Processing",
        parallelTip: "Compress multiple videos at once. Higher numbers use more CPU.",
        bestQuality: "Best Quality",
        bestQualityDesc: "Visually identical to original. ~30-50% reduction.",
        balanced: "Balanced",
        balancedDesc: "Great for sharing. High quality, optimized size.",
        smallestSize: "Smallest Size",
        smallestSizeDesc: "Maximum compression for quick messaging.",
        subjectiveVQ: "Perceptual Quality Magic",
        subjectiveVQTip: "Focuses quality where human eyes notice most (faces, brightness). Reduces size while looking better!",
        hdr: "Keep HDR Colors (10-bit)",
        hdrTip: "Preserves the vivid colors of iPhone/Galaxy HDR videos. Essential for modern phone clips.",
        metadata: "Metadata Cleaning",
        metadataTip: "Removes technical metadata (GPS, device info) to protect your privacy.",
        highEfficiency: "Next-Gen Compression (AV1)",
        highEfficiencyTip: "Enables ~30% better compression using latest AV1 technology. Requires AV1 codec on playback device.",
        downloadCodec: "Download AV1 Codec",
        folderOpen: "Open in folder",
        taskType: "Task Type",
        videoCompression: "Video Compression",
        imageCompression: "Image Compression",
        imageSettings: "Image Compression Settings",
        outputFormat: "Output Format",
        imageQuality: "Image Quality",
        showcase_title_1: "Real Compression Examples",
        showcase_title_2: "",
        showcase_subtitle: "Check compression performance with the real UI!\n* Compression ratio may vary depending on compression options."
    },
    ko: {
        dropText: "동영상을 이곳에 드래그하여 용량을 줄이세요",
        browse: "파일 찾기",
        files: "파일 대기열",
        queued: "대기 중",
        processing: "처리 중...",
        completed: "완료",
        settings: "기본 설정",
        advanced: "고급 설정",
        format: "출력 형식",
        resolution: "해상도 조절",
        audio: "오디오 설정",
        removeAudio: "오디오 제거 (음소거)",
        fileMgmt: "파일 관리",
        moveToTrash: "압축 완료 후 원본 휴지통으로 이동",
        start: "압축 시작",
        stop: "중단",
        totalProgress: "전체 진행률",
        eta: "남은 시간",
        remove: "삭제",
        clearAll: "전체 삭제",
        theme: "테마",
        language: "언어",
        custom: "직접 입력",
        original: "원본 해상도",
        lockRatio: "비율 고정",
        quality: "압축률 설정",
        highQuality: "고화질",
        highCompression: "고압축",
        instagram: "인스타그램 (1080p)",
        youtube: "유튜브 (4K)",
        originalSizeText: "원본 용량",
        estResultText: "예상 결과",
        estReductionText: "평균 압축 효율",
        reductionOff: "감소",
        batchNote: "SVT-AV1 엔진이 {count}개의 파일을 최적화 중입니다",
        outputDest: "파일 저장 위치",
        sameAsOriginal: "원본 파일과 같은 폴더에 저장",
        selectFolder: "저장 위치 직접 선택",
        saveTo: "저장 경로",
        legal: "이용약관 및 개인정보 정책",
        buyNow: "지금 구매하기",
        turbo: "터보 가속 모드",
        turboTip: "하드웨어 가속(GPU) 및 최적화된 프리셋을 사용하여 압축 속도를 최대 3배 이상 높여줍니다.",
        parallel: "병렬 압축",
        parallelTip: "여러 파일을 동시에 압축합니다. CPU 성능에 따라 속도가 달라집니다.",
        bestQuality: "최고 화질",
        bestQualityDesc: "원본과 거의 동일한 화질. 용량은 30-50% 줄어듭니다.",
        balanced: "균형 모드 (추천)",
        balancedDesc: "공유하기 딱 좋은 품질과 용량입니다. 가장 안전한 선택!",
        smallestSize: "용량 우선",
        smallestSizeDesc: "카톡 전송용으로 최고! 용량을 극한까지 줄입니다.",
        subjectiveVQ: "인지 화질 최적화 (매직)",
        subjectiveVQTip: "사람 눈이 민감한 곳 위주로 화질을 챙깁니다. 용량은 더 줄고 화질은 더 좋아 보입니다!",
        hdr: "HDR 색감 유지 (10-bit)",
        hdrTip: "전문가급 영상 배포를 위한 고대역폭 색상을 지원합니다.",
        metadata: "메타데이터 클리닝",
        metadataTip: "GPS, 기기 정보 등 사생활 정보를 깨끗이 제거합니다.",
        highEfficiency: "차세대 고압축 (AV1)",
        highEfficiencyTip: "최신 AV1 기술로 30% 더 압축합니다.",
        downloadCodec: "AV1 코덱 다운로드 (무료)",
        folderOpen: "저장 폴더 열기",
        taskType: "작업 타입",
        videoCompression: "동영상 압축",
        imageCompression: "이미지 압축",
        imageSettings: "이미지 압축 설정",
        outputFormat: "결과 포맷",
        imageQuality: "이미지 품질",
        showcase_title_1: "실제 압축 예시",
        showcase_title_2: "",
        showcase_subtitle: "압축 성능을 실제 UI와 함께 확인해보세요 !\n* 압축 옵션에 따라 압축률이 달라질 수 있습니다."
    }
};

const FORMAT_OPTIONS = ['MP4', 'WebM', 'MKV', 'GIF'];
const RESOLUTION_OPTIONS = ['Original', '4K', '1080p', '720p', '480p', 'Instagram', 'YouTube', 'Custom'];
const IMAGE_FORMAT_OPTIONS = ['JPG', 'PNG', 'WEBP'];

// --- Tooltip Helper ---
const Tooltip = ({ text, theme }: { text: string, theme: 'light' | 'dark' }) => (
    <div className="group relative inline-block ml-1 align-middle">
        <Info size={14} className="text-gray-400 cursor-help" />
        <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border border-gray-100 shadow-xl'} text-[11px] rounded z-50`}>
            {text}
            <div className={`absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent ${theme === 'dark' ? 'border-t-gray-900' : 'border-t-white'}`}></div>
        </div>
    </div>
);

const InterfaceShowcase: React.FC = () => {
    const { i18n } = useI18n();
    const { theme: globalTheme, toggleTheme } = useGlobalTheme();

    // Robust language detection
    const currentLang = i18n.language || 'en';
    const language = currentLang.toLowerCase().startsWith('ko') ? 'ko' : 'en';

    const theme = globalTheme as 'light' | 'dark';
    const t = TRANSLATIONS[language];

    const createVideoSamples = (): VideoFile[] => ([
        {
            id: 'v-sample-1',
            path: 'family_trip_4k_001.mp4',
            name: 'family_trip_4k_001.mp4',
            status: 'completed',
            originalSize: 1240 * 1024 * 1024,
            compressedSize: 258 * 1024 * 1024,
            progress: 100,
        },
        {
            id: 'v-sample-2',
            path: 'kids_school_event_1080p.mp4',
            name: 'kids_school_event_1080p.mp4',
            status: 'completed',
            originalSize: 860 * 1024 * 1024,
            compressedSize: 176 * 1024 * 1024,
            progress: 100,
        },
        {
            id: 'v-sample-3',
            path: 'wedding_highlight_4k.mp4',
            name: 'wedding_highlight_4k.mp4',
            status: 'completed',
            originalSize: 1520 * 1024 * 1024,
            compressedSize: 320 * 1024 * 1024,
            progress: 100,
        },
        {
            id: 'v-sample-4',
            path: 'vacation_sunset_drone.mp4',
            name: 'vacation_sunset_drone.mp4',
            status: 'completed',
            originalSize: 980 * 1024 * 1024,
            compressedSize: 205 * 1024 * 1024,
            progress: 100,
        },
        {
            id: 'v-sample-5',
            path: 'birthday_party_1080p.mp4',
            name: 'birthday_party_1080p.mp4',
            status: 'completed',
            originalSize: 740 * 1024 * 1024,
            compressedSize: 154 * 1024 * 1024,
            progress: 100,
        },
    ]);

    const createImageSamples = (): VideoFile[] => ([
        {
            id: 'i-sample-1',
            path: '20211219_145249.jpg',
            name: '20211219_145249.jpg',
            status: 'completed',
            originalSize: Math.round(3.17 * 1024 * 1024),
            compressedSize: Math.round(0.98 * 1024 * 1024),
            progress: 100,
        },
        {
            id: 'i-sample-2',
            path: '20211219_145238.jpg',
            name: '20211219_145238.jpg',
            status: 'completed',
            originalSize: Math.round(2.95 * 1024 * 1024),
            compressedSize: Math.round(0.86 * 1024 * 1024),
            progress: 100,
        },
        {
            id: 'i-sample-3',
            path: '20211219_145215.jpg',
            name: '20211219_145215.jpg',
            status: 'completed',
            originalSize: Math.round(3.18 * 1024 * 1024),
            compressedSize: Math.round(0.90 * 1024 * 1024),
            progress: 100,
        },
        {
            id: 'i-sample-4',
            path: '20211219_103810.jpg',
            name: '20211219_103810.jpg',
            status: 'completed',
            originalSize: Math.round(2.69 * 1024 * 1024),
            compressedSize: Math.round(0.82 * 1024 * 1024),
            progress: 100,
        },
        {
            id: 'i-sample-5',
            path: '20211219_103808.jpg',
            name: '20211219_103808.jpg',
            status: 'completed',
            originalSize: Math.round(3.05 * 1024 * 1024),
            compressedSize: Math.round(0.95 * 1024 * 1024),
            progress: 100,
        },
    ]);

    const [files, setFiles] = useState<VideoFile[]>([]);
    const [settings, setSettings] = useState<CompressionSettings>({
        format: 'MP4',
        resolution: 'Original',
        lockAspectRatio: true,
        compressionLevel: 6,
        removeAudio: false,
        moveToTrash: false,
        subjectiveVQ: true,
        enableHDR: false,
        cleanMetadata: false,
        enableTurbo: false,
        parallelLimit: 2,
        outputMode: 'Same',
        useHighEfficiencyCodec: false,
        imageFormat: 'JPG',
        imageQuality: 80,
    });
    const [processingMode, setProcessingMode] = useState<'video' | 'image'>('video');
    const [isProcessing, setIsProcessing] = useState(false);
    const [totalProgress, setTotalProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const processingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        setFiles(processingMode === 'video' ? createVideoSamples() : createImageSamples());
        setIsProcessing(false);
        setTotalProgress(0);
    }, [processingMode]);

    // --- Mock Handlers ---
    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files;
        if (!selected) return;
        const newFiles = Array.from(selected).map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            path: file.name,
            name: file.name,
            status: 'queued' as const,
            originalSize: file.size,
            progress: 0,
        }));
        setFiles(prev => [...prev, ...newFiles]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleStart = () => {
        if (files.length === 0) return;
        if (isProcessing) {
            setIsProcessing(false);
            if (processingIntervalRef.current) clearInterval(processingIntervalRef.current);
            setFiles(prev => prev.map(f => f.status === 'processing' ? { ...f, status: 'queued', progress: 0 } : f));
            return;
        }

        setIsProcessing(true);
        setTotalProgress(0);

        let progress = 0;
        processingIntervalRef.current = setInterval(() => {
            progress += 0.5;
            setTotalProgress(Math.min(progress, 100));

            setFiles(prev => {
                const updated = prev.map(f => {
                    if (f.status === 'queued' || f.status === 'processing') {
                        const newProgress = Math.min(f.progress + Math.random() * 2, 100);
                        return {
                            ...f,
                            status: (newProgress >= 100 ? 'completed' : 'processing') as VideoFile['status'],
                            progress: newProgress,
                            compressedSize: newProgress >= 100 ? f.originalSize * (0.3 + Math.random() * 0.2) : undefined
                        };
                    }
                    return f;
                });

                const allDone = updated.every(f => f.status === 'completed');
                if (allDone) {
                    setIsProcessing(false);
                    if (processingIntervalRef.current) clearInterval(processingIntervalRef.current);
                }
                return updated;
            });
        }, 50);
    };

    const updateSettings = (partial: Partial<CompressionSettings>) => {
        setSettings(prev => ({ ...prev, ...partial }));
    };

    const subtitleLines = t.showcase_subtitle.split('\n');

    return (
        <section id="features" className="pt-16 pb-8 lg:pt-24 lg:pb-32 relative overflow-hidden bg-[var(--bg-secondary)] border-y border-[var(--card-border)] transition-colors duration-300">
            {/* Page Header */}
            <div className="max-w-[1350px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center mb-16 space-y-4">
                <h2 className={`text-4xl md:text-5xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'} tracking-tight`}>
                    {t.showcase_title_1}<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8b5cf6] to-cyan-400">{t.showcase_title_2}</span>
                </h2>
                <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} text-lg font-medium tracking-tight`}>
                    <span>{subtitleLines[0]}</span>
                    {subtitleLines[1] && (
                        <>
                            <br />
                            <span className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'} opacity-80`}>
                                {subtitleLines[1]}
                            </span>
                        </>
                    )}
                </p>
                <div className="flex items-center justify-center gap-2">
                    <button
                        type="button"
                        onClick={() => setProcessingMode('video')}
                        className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${processingMode === 'video'
                            ? 'bg-[#8b5cf6] border-[#8b5cf6] text-white'
                            : `${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-gray-200 text-gray-700'}`}`}
                    >
                        {language === 'ko' ? '영상 샘플 보기' : 'Video Samples'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setProcessingMode('image')}
                        className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${processingMode === 'image'
                            ? 'bg-[#8b5cf6] border-[#8b5cf6] text-white'
                            : `${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-gray-200 text-gray-700'}`}`}
                    >
                        {language === 'ko' ? '이미지 샘플 보기' : 'Image Samples'}
                    </button>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>
                        {language === 'ko' ? '샘플 데이터' : 'Sample Data'}
                    </span>
                </div>
            </div>

            {/* Main Window Shell - Scaled for Mobile */}
            <div className="relative w-full h-[260px] sm:h-[450px] md:h-[620px] lg:h-[880px] overflow-visible">
                <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[1280px] origin-top scale-[0.28] sm:scale-[0.5] md:scale-[0.7] lg:scale-100 transition-transform duration-500">
                    <div className={`w-full ${theme === 'dark' ? 'bg-slate-950 border-white/10 ring-white/5' : 'bg-gray-50 border-gray-200 ring-gray-200'} border rounded-3xl shadow-[0_60px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col h-[850px] ring-1 relative transition-colors duration-300 ${theme}`}>

                        {/* Header (Mocks Header.tsx) */}
                        <header className={`h-16 border-b ${theme === 'dark' ? 'bg-slate-950 border-gray-800' : 'bg-white border-gray-200'} flex items-center justify-between px-6 transition-colors duration-300 relative z-20`}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#8b5cf6] rounded-xl shadow-[0_4px_12px_rgba(139,92,246,0.3)]">
                                    <Video className="text-white" size={20} />
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'} tracking-tighter uppercase`}>VELO</span>
                                        <span className="text-[10px] bg-[#8b5cf6] text-white px-1.5 py-0.5 rounded-full font-bold">PRO</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#8b5cf6] cursor-pointer transition-colors font-medium">
                                        velo.smileon.app <ExternalLink size={10} />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className={`flex items-center gap-2 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-gray-100 border-gray-200'} p-1 rounded-full border`}>
                                    <button
                                        onClick={() => i18n.changeLanguage('en')}
                                        className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${language === 'en' ? (theme === 'dark' ? 'bg-slate-700 text-[#8b5cf6]' : 'bg-white text-[#8b5cf6]') : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        EN
                                    </button>
                                    <button
                                        onClick={() => i18n.changeLanguage('ko')}
                                        className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${language === 'ko' ? (theme === 'dark' ? 'bg-slate-700 text-[#8b5cf6]' : 'bg-white text-[#8b5cf6]') : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        한국어
                                    </button>
                                </div>
                                <button onClick={toggleTheme} className={`p-2 rounded-lg ${theme === 'dark' ? 'text-slate-400 hover:bg-slate-800' : 'text-gray-500 hover:bg-gray-100'} transition-colors`}>
                                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                                </button>
                            </div>
                        </header>

                        <main className="flex-1 flex overflow-hidden">

                            {/* Left: Sidebar (60%) */}
                            <div className={`flex-[3] border-r ${theme === 'dark' ? 'border-gray-800 bg-slate-900/50' : 'border-gray-200 bg-gray-50'} h-full flex flex-col p-6 gap-6 overflow-hidden transition-colors`}>
                                {/* Drop Zone */}
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`group relative flex flex-col items-center justify-center p-8 border-2 border-dashed ${theme === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-gray-300 bg-white'} rounded-2xl hover:border-[#8b5cf6] transition-all cursor-pointer shadow-sm hover:shadow-md h-48 shrink-0`}
                                >
                                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} accept={processingMode === 'video' ? 'video/*' : 'image/*'} />
                                    <div className="w-12 h-12 mb-4 rounded-full bg-purple-50 dark:bg-purple-900/20 text-[#8b5cf6] flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <UploadCloud size={24} />
                                    </div>
                                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'} font-medium text-center`}>
                                        {processingMode === 'video' ? t.dropText : (language === 'ko' ? '이미지를 이곳에 드래그하여 용량을 줄이세요' : 'Drop your images here to lighten')}
                                    </p>
                                    <p className="mt-2 text-xs text-gray-400 dark:text-slate-500 uppercase tracking-widest font-bold">
                                        {processingMode === 'video' ? 'MP4, MOV, MKV, AVI' : 'JPG, PNG, WEBP'}
                                    </p>
                                </div>

                                {/* File Queue */}
                                <div className="flex flex-col flex-1 min-h-0">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Files className="text-[#8b5cf6]" size={18} />
                                            <h2 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} uppercase tracking-wider`}>{t.files}</h2>
                                            <span className={`${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'} text-[10px] px-1.5 py-0.5 rounded-full font-bold`}>{files.length}</span>
                                        </div>
                                        {files.length > 0 && (
                                            <button onClick={() => setFiles([])} className="text-[10px] font-bold text-red-500 hover:text-red-400 flex items-center gap-1 transition-colors uppercase tracking-tighter">
                                                <Trash2 size={12} /> {t.clearAll}
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                        {files.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-slate-600 opacity-50">
                                                {processingMode === 'video' ? <FileVideo size={48} className="mb-2" /> : <ImageIcon size={48} className="mb-2" />}
                                                <p className="text-sm">No files queued</p>
                                            </div>
                                        ) : (
                                            files.map(file => (
                                                <div key={file.id} className={`group relative flex items-center p-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'} rounded-xl border shadow-sm transition-all hover:shadow-md`}>
                                                    <div className="mr-3 shrink-0">
                                                        {file.status === 'completed' ? (
                                                            <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 flex items-center justify-center"><CheckCircle2 size={20} /></div>
                                                        ) : file.status === 'processing' ? (
                                                            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-[#8b5cf6] flex items-center justify-center"><Loader2 size={20} className="animate-spin" /></div>
                                                        ) : (
                                                            <div className={`w-10 h-10 rounded-lg ${theme === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'} flex items-center justify-center`}>
                                                                {processingMode === 'video' ? <FileVideo size={20} /> : <ImageIcon size={20} />}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0 mr-2">
                                                        <h3 className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-900'} truncate`}>{file.name}</h3>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>{formatSize(file.originalSize)}</span>
                                                            {file.status === 'completed' && file.compressedSize && (
                                                                <>
                                                                    <span className="text-xs text-gray-400 dark:text-slate-600">→</span>
                                                                    <span className="text-xs font-bold text-green-600 dark:text-green-400">{formatSize(file.compressedSize)}</span>
                                                                    <span className="text-[10px] font-bold text-green-600/70 dark:text-green-400/70 bg-green-50 dark:bg-green-900/20 px-1 rounded">-{Math.round((1 - file.compressedSize / file.originalSize) * 100)}%</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        {file.status === 'processing' && (
                                                            <div className={`mt-1.5 h-1 w-full ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                                                                <div className="h-full bg-[#8b5cf6] transition-all duration-300 ease-out" style={{ width: `${file.progress}%` }} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Settings (40%) */}
                            <div className={`flex-[2] ${theme === 'dark' ? 'bg-slate-950' : 'bg-white'} p-6 overflow-y-auto custom-scrollbar transition-colors`}>
                                <div className="flex items-center gap-2 mb-6 shrink-0">
                                    <Settings2 className="text-[#8b5cf6]" size={20} />
                                    <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.settings}</h2>
                                </div>

                                <div className="space-y-6">
                                    <div className={`p-4 ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-gray-50 border-gray-100'} rounded-2xl border space-y-3`}>
                                        <label className={`block text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'} uppercase tracking-wider`}>{t.taskType}</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setProcessingMode('video')}
                                                className={`rounded-xl px-3 py-2 text-xs font-bold border transition-all ${processingMode === 'video'
                                                    ? 'bg-white dark:bg-slate-800 border-[#8b5cf6] text-[#8b5cf6]'
                                                    : 'bg-transparent border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'}`}
                                            >
                                                {t.videoCompression}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setProcessingMode('image')}
                                                className={`rounded-xl px-3 py-2 text-xs font-bold border transition-all ${processingMode === 'image'
                                                    ? 'bg-white dark:bg-slate-800 border-[#8b5cf6] text-[#8b5cf6]'
                                                    : 'bg-transparent border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'}`}
                                            >
                                                {t.imageCompression}
                                            </button>
                                        </div>
                                    </div>

                                    {processingMode === 'video' && (
                                    <div className={`p-4 ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-gray-50 border-gray-100'} rounded-2xl border space-y-4`}>
                                        <div className="grid grid-cols-2 gap-4">
                                            <section>
                                                <label className={`block text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'} mb-2 uppercase tracking-wider`}>{t.format}</label>
                                                <div className="relative">
                                                    <select
                                                        className={`w-full ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900'} border text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-[#8b5cf6] outline-none transition-all appearance-none cursor-pointer font-bold`}
                                                        value={settings.format}
                                                        onChange={(e) => updateSettings({ format: e.target.value as CompressionSettings['format'] })}
                                                    >
                                                        {FORMAT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                    <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'} pointer-events-none`} size={16} />
                                                </div>
                                            </section>
                                            <section>
                                                <label className={`block text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'} mb-2 uppercase tracking-wider`}>{t.resolution}</label>
                                                <div className="relative">
                                                    <select
                                                        className={`w-full ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900'} border text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-[#8b5cf6] outline-none transition-all appearance-none cursor-pointer font-bold`}
                                                        value={settings.resolution}
                                                        onChange={(e) => updateSettings({ resolution: e.target.value as ResolutionPreset })}
                                                    >
                                                        {RESOLUTION_OPTIONS.map(opt => <option key={opt} value={opt}>{t[opt.toLowerCase() as keyof typeof t] || opt}</option>)}
                                                    </select>
                                                    <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'} pointer-events-none`} size={16} />
                                                </div>
                                            </section>
                                            <section className="col-span-2">
                                                <label className={`flex items-center gap-3 p-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} rounded-xl hover:border-[#8b5cf6] transition-all cursor-pointer group mb-1 border`}>
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <Monitor size={16} className={settings.useHighEfficiencyCodec ? 'text-[#8b5cf6]' : (theme === 'dark' ? 'text-slate-500' : 'text-gray-400')} />
                                                        <div>
                                                            <div className="flex items-center gap-1">
                                                                <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>{t.highEfficiency}</span>
                                                                <Tooltip text={t.highEfficiencyTip} theme={theme} />
                                                            </div>
                                                            <p className={`text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'} mt-0.5`}>AV1 (Maximum Compression)</p>
                                                        </div>
                                                    </div>
                                                    <input type="checkbox" checked={settings.useHighEfficiencyCodec} onChange={(e) => updateSettings({ useHighEfficiencyCodec: e.target.checked })} className="w-4 h-4 rounded text-[#8b5cf6] focus:ring-[#8b5cf6]" />
                                                </label>
                                            </section>
                                        </div>
                                    </div>
                                    )}

                                    {processingMode === 'image' && (
                                        <div className={`p-4 ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-gray-50 border-gray-100'} rounded-2xl border space-y-4`}>
                                            <div className="flex items-center gap-2">
                                                <ImageIcon size={14} className="text-[#8b5cf6]" />
                                                <label className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'} uppercase tracking-wider`}>{t.imageSettings}</label>
                                            </div>
                                            <section>
                                                <label className={`block text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'} mb-2 uppercase tracking-wider`}>{t.outputFormat}</label>
                                                <div className="relative">
                                                    <select
                                                        className={`w-full ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900'} border text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-[#8b5cf6] outline-none transition-all appearance-none cursor-pointer font-bold`}
                                                        value={settings.imageFormat}
                                                        onChange={(e) => updateSettings({ imageFormat: e.target.value as CompressionSettings['imageFormat'] })}
                                                    >
                                                        {IMAGE_FORMAT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                    <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'} pointer-events-none`} size={16} />
                                                </div>
                                            </section>
                                            <section>
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'} uppercase tracking-wider`}>{t.imageQuality}</label>
                                                    <span className="text-xs font-bold px-2 py-0.5 bg-[#8b5cf6] text-white rounded-full">{settings.imageQuality}</span>
                                                </div>
                                                <input type="range" min="1" max="100" step="1" value={settings.imageQuality} onChange={(e) => updateSettings({ imageQuality: parseInt(e.target.value) })} className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#8b5cf6]" />
                                            </section>
                                        </div>
                                    )}

                                    {/* Output Destination Selection Card */}
                                    <div className={`p-4 ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-gray-50 border-gray-100'} rounded-2xl border transition-colors`}>
                                        <label className={`block text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'} mb-3 uppercase tracking-wider flex items-center gap-2`}>
                                            <FolderOpen size={14} /> {t.outputDest}
                                        </label>
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input type="radio" name="outputMode" checked={settings.outputMode === 'Same'} onChange={() => updateSettings({ outputMode: 'Same' })} className="text-[#8b5cf6] focus:ring-0" />
                                                <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.sameAsOriginal}</span>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input type="radio" name="outputMode" checked={settings.outputMode === 'Custom'} onChange={() => updateSettings({ outputMode: 'Custom' })} className="text-[#8b5cf6] focus:ring-0" />
                                                <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.selectFolder}</span>
                                            </label>
                                        </div>
                                    </div>

                                    {processingMode === 'video' && (
                                    <section className={`p-4 ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-gray-50 border-gray-100'} rounded-2xl border transition-colors`}>
                                        <div className="flex justify-between items-center mb-4">
                                            <label className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'} uppercase tracking-wider flex items-center gap-2`}><Sliders size={14} /> {t.quality}</label>
                                            <span className="text-xs font-bold px-2 py-0.5 bg-[#8b5cf6] text-white rounded-full">Level {settings.compressionLevel}</span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 mb-6">
                                            {[4, 6, 8].map(level => {
                                                const type = level === 4 ? 'best' : level === 6 ? 'balanced' : 'smallest';
                                                const isActive = settings.compressionLevel === level;
                                                return (
                                                    <button
                                                        key={level}
                                                        onClick={() => updateSettings({ compressionLevel: level })}
                                                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${isActive ? (theme === 'dark' ? 'bg-slate-800 border-[#8b5cf6] ring-1 ring-[#8b5cf6]' : 'bg-white border-[#8b5cf6] ring-1 ring-[#8b5cf6]') : 'bg-transparent border-transparent'}`}
                                                    >
                                                        <span className="text-xl mb-1">{type === 'best' ? '💎' : type === 'balanced' ? '⚖️' : '⚡'}</span>
                                                        <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>{type === 'best' ? t.bestQuality : type === 'balanced' ? '균형 모드' : t.smallestSize}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className={`mb-4 p-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'} rounded-xl border`}>
                                            <p className={`text-xs text-center ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'} font-medium leading-relaxed px-2`}>
                                                {settings.compressionLevel <= 4 ? t.bestQualityDesc : settings.compressionLevel >= 8 ? t.smallestSizeDesc : t.balancedDesc}
                                            </p>
                                        </div>

                                        <input type="range" min="1" max="10" step="1" value={settings.compressionLevel} onChange={(e) => updateSettings({ compressionLevel: parseInt(e.target.value) })} className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#8b5cf6]" />
                                        <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                                            <span>{t.highQuality}</span>
                                            <span>{t.highCompression}</span>
                                        </div>
                                    </section>
                                    )}

                                    {processingMode === 'video' && (
                                    <>
                                    <div className="flex items-center gap-2 mt-4 mb-2">
                                        <Sparkles className="text-amber-500" size={16} />
                                        <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.advanced}</h3>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 pb-8">
                                        <label className={`group flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'} rounded-xl hover:border-[#8b5cf6] transition-all cursor-pointer border`}>
                                            <div className="flex items-center gap-3">
                                                <Wand2 size={16} className="text-purple-500 group-hover:scale-110 transition-transform" />
                                                <div className="flex items-center gap-1"><span className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>{t.subjectiveVQ}</span><Tooltip text={t.subjectiveVQTip} theme={theme} /></div>
                                            </div>
                                            <input type="checkbox" checked={settings.subjectiveVQ} onChange={(e) => updateSettings({ subjectiveVQ: e.target.checked })} className="w-4 h-4 rounded text-[#8b5cf6] focus:ring-0" />
                                        </label>

                                        <label className={`group flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'} rounded-xl hover:border-[#8b5cf6] transition-all cursor-pointer border`}>
                                            <div className="flex items-center gap-3">
                                                <Monitor size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
                                                <div className="flex items-center gap-1"><span className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>{t.hdr}</span><Tooltip text={t.hdrTip} theme={theme} /></div>
                                            </div>
                                            <input type="checkbox" checked={settings.enableHDR} onChange={(e) => updateSettings({ enableHDR: e.target.checked })} className="w-4 h-4 rounded text-[#8b5cf6] focus:ring-0" />
                                        </label>

                                        <label className={`group flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-purple-900/10 border-blue-900/30' : 'bg-purple-50 border-purple-100'} rounded-xl transition-all border ring-1 ring-[#8b5cf6]/10`}>
                                            <div className="flex items-center gap-3">
                                                <Zap size={16} className="text-[#8b5cf6]" />
                                                <div className="flex items-center gap-1"><span className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-purple-700'}`}>{t.turbo}</span><Tooltip text={t.turboTip} theme={theme} /></div>
                                            </div>
                                            <input type="checkbox" checked={settings.enableTurbo} onChange={(e) => updateSettings({ enableTurbo: e.target.checked })} className="w-4 h-4 rounded text-[#8b5cf6] focus:ring-[#8b5cf6]" />
                                        </label>

                                        <label className={`group flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'} rounded-xl hover:border-[#8b5cf6] transition-all cursor-pointer border`}>
                                            <div className="flex items-center gap-3">
                                                <ShieldCheck size={16} className={`${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'} group-hover:text-[#8b5cf6]`} />
                                                <div className="flex items-center gap-1"><span className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>{t.metadata}</span><Tooltip text={t.metadataTip} theme={theme} /></div>
                                            </div>
                                            <input type="checkbox" checked={settings.cleanMetadata} onChange={(e) => updateSettings({ cleanMetadata: e.target.checked })} className="w-4 h-4 rounded text-[#8b5cf6] focus:ring-0" />
                                        </label>

                                        <label className={`group flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'} rounded-xl hover:border-red-500 transition-all cursor-pointer border`}>
                                            <div className="flex items-center gap-3">
                                                <VolumeX size={16} className={`${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'} group-hover:text-red-500`} />
                                                <span className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>{t.removeAudio}</span>
                                            </div>
                                            <input type="checkbox" checked={settings.removeAudio} onChange={(e) => updateSettings({ removeAudio: e.target.checked })} className="w-4 h-4 rounded text-[#8b5cf6] focus:ring-0" />
                                        </label>

                                        <label className={`group flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'} rounded-xl hover:border-red-500 transition-all cursor-pointer border`}>
                                            <div className="flex items-center gap-3">
                                                <Trash2 size={16} className={`${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'} group-hover:text-red-500`} />
                                                <span className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>{t.moveToTrash}</span>
                                            </div>
                                            <input type="checkbox" checked={settings.moveToTrash} onChange={(e) => updateSettings({ moveToTrash: e.target.checked })} className="w-4 h-4 rounded text-[#8b5cf6] focus:ring-0" />
                                        </label>
                                    </div>
                                    </>
                                    )}

                                    {processingMode === 'image' && (
                                        <div className="grid grid-cols-1 gap-3 pb-8">
                                            <div className={`group flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'} rounded-xl border`}>
                                                <div className="flex items-center gap-3">
                                                    <Sparkles size={16} className="text-purple-500" />
                                                    <div className="flex items-center gap-1"><span className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>{t.parallel}</span><Tooltip text={t.parallelTip} theme={theme} /></div>
                                                </div>
                                                <select value={settings.parallelLimit} onChange={(e) => updateSettings({ parallelLimit: parseInt(e.target.value) })} className={`text-xs font-bold rounded p-1 ${theme === 'dark' ? 'bg-slate-800 text-slate-200' : 'bg-gray-50 text-gray-700'}`}>
                                                    <option value={1}>1</option>
                                                    <option value={2}>2</option>
                                                    <option value={4}>4</option>
                                                    <option value={8}>8</option>
                                                </select>
                                            </div>
                                            <label className={`group flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'} rounded-xl hover:border-red-500 transition-all cursor-pointer border`}>
                                                <div className="flex items-center gap-3">
                                                    <Trash2 size={16} className={`${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'} group-hover:text-red-500`} />
                                                    <span className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>{t.moveToTrash}</span>
                                                </div>
                                                <input type="checkbox" checked={settings.moveToTrash} onChange={(e) => updateSettings({ moveToTrash: e.target.checked })} className="w-4 h-4 rounded text-[#8b5cf6] focus:ring-0" />
                                            </label>
                                        </div>
                                    )}

                                    {/* Legal Link */}
                                    <div className="mt-auto pt-6 pb-4 flex justify-center">
                                        <button className={`flex items-center gap-1.5 text-[10px] font-bold ${theme === 'dark' ? 'text-slate-600 hover:text-[#8b5cf6]' : 'text-gray-400 hover:text-[#8b5cf6]'} transition-colors uppercase tracking-widest`}>
                                            <ShieldCheck size={12} /> {t.legal}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </main>

                        {/* Bottom Bar (Mocks BottomBar.tsx) */}
                        <footer className={`h-24 ${theme === 'dark' ? 'bg-slate-950 border-slate-800 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]' : 'bg-white border-gray-200 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]'} border-t flex items-center justify-between px-8 gap-8 shrink-0 relative z-10 transition-colors`}>
                            <div className="flex-1 max-w-2xl">
                                {isProcessing ? (
                                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex justify-between items-end mb-2">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-[#8b5cf6] uppercase tracking-wider mb-0.5">{t.processing}</span>
                                                <span className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} truncate max-w-xs`}>{files.find(f => f.status === 'processing')?.name || "Initializing..."}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'} tabular-nums`}>{Math.round(totalProgress)}%</span>
                                                <span className={`text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'} font-bold uppercase block`}>{t.eta}: ~1 min</span>
                                            </div>
                                        </div>
                                        <div className={`h-2 w-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                                            <div className="h-full bg-gradient-to-r from-[#8b5cf6] to-indigo-600 transition-all duration-300 ease-out fill-available" style={{ width: `${totalProgress}%` }} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2.5 h-2.5 rounded-full ${files.length > 0 ? 'bg-green-500 animate-pulse' : (theme === 'dark' ? 'bg-slate-800' : 'bg-gray-300')}`} />
                                        <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'} font-bold uppercase tracking-wider`}>
                                            {files.length > 0 ? `${files.length} FILES READY TO LIGHTEN` : (processingMode === 'video' ? 'ADD VIDEOS TO BEGIN' : 'ADD IMAGES TO BEGIN')}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleStart}
                                disabled={files.length === 0}
                                className={`relative overflow-hidden group px-12 py-3.5 rounded-xl font-black text-white shadow-xl transition-all duration-300 transform active:scale-95 text-sm uppercase tracking-widest ${files.length === 0 ? (theme === 'dark' ? 'bg-slate-800 text-slate-600 grayscale opacity-50' : 'bg-gray-200 text-gray-400 grayscale opacity-50') : isProcessing ? 'bg-rose-600 hover:bg-rose-500' : 'bg-[#8B5CF6] hover:bg-purple-600'}`}
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    {isProcessing ? <><Loader2 size={18} className="animate-spin" /> {t.stop}</> : <><Play size={18} fill="currentColor" /> {t.start}</>}
                                </span>
                            </button>
                        </footer>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default InterfaceShowcase;
