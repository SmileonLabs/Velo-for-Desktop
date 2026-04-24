export interface VideoFile {
    id: string;
    path: string;
    name: string;
    status: 'idle' | 'queued' | 'processing' | 'completed' | 'error';
    originalSize: number;
    compressedSize?: number;
    outputPath?: string;
    progress: number;
    // 폴더 모드에서 video/image 혼재 처리용 — 없으면 App의 processingMode 전역값 사용.
    mediaType?: 'video' | 'image';
    // 재실행 skip 룰 — 이미 출력 파일이 존재해 압축 건너뛴 경우 true. status는 'completed'로 둠.
    skipped?: boolean;
}

export type OutputFormat = 'MP4' | 'MOV' | 'GIF';
export type Resolution = 'Original' | '1080p' | '720p' | '480p';

export type ResolutionPreset = 'Original' | '4K' | '1080p' | '720p' | '480p' | 'Custom' | 'Instagram' | 'YouTube';

export interface CompressionSettings {
    format: 'MP4' | 'WebM' | 'MKV' | 'GIF';
    resolution: ResolutionPreset;
    customWidth?: number;
    customHeight?: number;
    lockAspectRatio: boolean;
    compressionLevel: number; // 1-10 (maps to CRF/Preset)
    removeAudio: boolean;
    moveToTrash: boolean; // Delete original
    subjectiveVQ: boolean; // Tune for visual
    enableHDR: boolean; // 10-bit HDR
    enableDeshake: boolean;
    cleanMetadata: boolean;
    enableTurbo: boolean;
    parallelLimit: number; // 1, 2, 3...
    enableWatermark: boolean;
    watermarkText?: string;
    enableThumbnail: boolean;
    outputMode: 'Same' | 'Custom';
    customOutputPath?: string;
    useHighEfficiencyCodec: boolean; // true = AV1 (High Tech), false = VP9 (Safe)
    // PNG는 무손실 방식이라 압축 효과가 미미 → 출력 옵션에서 제외.
    imageFormat: 'JPG' | 'WEBP';
    imageQuality: number; // 1-100
}

export type Language = 'en' | 'ko';

export interface Translation {
    dropText: string;
    browse: string;
    files: string;
    queued: string;
    processing: string;
    completed: string;
    settings: string;
    advanced: string;
    format: string;
    resolution: string;
    audio: string;
    removeAudio: string;
    fileMgmt: string;
    moveToTrash: string;
    start: string;
    stop: string;
    totalProgress: string;
    eta: string;
    remove: string;
    clearAll: string;
    theme: string;
    language: string;
    // New fields
    custom: string;
    lockRatio: string;
    quality: string;
    highQuality: string;
    highCompression: string;
    instagram: string;
    youtube: string;
    originalSizeText: string;
    estResultText: string;
    estReductionText: string;
    reductionOff: string;
    batchNote: string;
    outputDest: string;
    sameAsOriginal: string;
    selectFolder: string;
    saveTo: string;
    legal: string;
    activateTitle: string;
    activateSub: string;
    licenseKey: string;
    activateBtn: string;
    verifying: string;
    buyNow: string;
    support: string;
    invalidKey: string;
    machineLocked: string;
    activationSuccess: string;
    turbo: string;
    turboTip: string;
    parallel: string;
    parallelTip: string;

    // Presets
    bestQuality: string;
    bestQualityDesc: string;
    balanced: string;
    balancedDesc: string;
    smallestSize: string;
    smallestSizeDesc: string;

    // Magic Features
    subjectiveVQ: string;
    subjectiveVQTip: string;
    hdr: string;
    hdrTip: string;
    metadata: string;
    metadataTip: string;

    folderOpen: string;
    highEfficiency: string;
    highEfficiencyTip: string;
    downloadCodec: string;
}
