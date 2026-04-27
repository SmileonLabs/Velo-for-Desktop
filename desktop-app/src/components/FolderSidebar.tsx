import React from 'react';
import { FolderOpen, FolderSearch, Files, FileVideo, Image as ImageIcon, FileIcon, RefreshCw, X } from 'lucide-react';
import { VideoFile, Language } from '../types';
import { TRANSLATIONS } from '../constants';

// 폴더 압축 모드 Sidebar. iOS/Android의 "폴더 압축" 개념을 데스크탑 파일시스템 기반으로 이식.
// 입력: 폴더 드래그 or 폴더 선택 다이얼로그.
// 스캔: Rust `scan_folder_media` 커맨드가 재귀 스캔 → 결과를 VideoFile로 변환해 App이 파이프라인 태움.

export interface FolderScanSummary {
    rootPath: string;
    totalCount: number;
    totalBytes: number;
    videoCount: number;
    imageCount: number;
}

interface FolderSidebarProps {
    scan: FolderScanSummary | null;
    files: VideoFile[];            // 스캔 → 변환된 파일 목록. App state와 공유.
    isProcessing: boolean;
    language: Language;
    onPickFolder: () => void;       // 폴더 선택 다이얼로그 트리거
    onDropFolder: (path: string) => void;  // OS drop event에서 넘어온 폴더 경로
    onReset: () => void;            // "다른 폴더" — scan + files 리셋
    onRemoveFile: (id: string) => void;
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function StatusBadge({ status, language }: { status: VideoFile['status']; language: Language }) {
    const map: Record<VideoFile['status'], { ko: string; en: string; cls: string }> = {
        idle: { ko: '대기', en: 'Idle', cls: 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400' },
        queued: { ko: '대기', en: 'Queued', cls: 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400' },
        processing: { ko: '처리 중', en: 'Processing', cls: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' },
        completed: { ko: '완료', en: 'Done', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
        error: { ko: '실패', en: 'Error', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    };
    const label = map[status];
    return (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${label.cls}`}>
            {language === 'ko' ? label.ko : label.en}
        </span>
    );
}

export const FolderSidebar: React.FC<FolderSidebarProps> = ({
    scan, files, isProcessing, language,
    onPickFolder, onDropFolder, onReset, onRemoveFile,
}) => {
    const t = TRANSLATIONS[language];
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // HTML5 drag에서 폴더 드롭 시 브라우저는 파일만 노출 — Tauri의 onDragDropEvent로 path 받음.
    // 이 onDrop은 브라우저 fallback / no-op.
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    if (!scan) {
        return (
            <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900/50 p-6 gap-6 overflow-hidden">
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={onPickFolder}
                    className="group relative flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 hover:border-primary-500 dark:hover:border-primary-500 transition-all cursor-pointer shadow-sm hover:shadow-md flex-1"
                >
                    <div className="w-14 h-14 mb-4 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FolderSearch size={28} />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-slate-300 font-medium text-center">
                        {t.folderDropPrompt}
                    </p>
                    <p className="mt-2 text-xs text-gray-400 dark:text-slate-500 text-center">
                        {t.folderDropDescription}
                    </p>
                    <p className="mt-2 text-[11px] text-gray-400 dark:text-slate-500 text-center">
                        {t.folderDropOutput}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900/50 p-6 gap-4 overflow-hidden">
            {/* 스캔 요약 헤더 */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-4 shrink-0">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                        <FolderOpen size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono text-gray-500 dark:text-slate-400 truncate" title={scan.rootPath}>
                            {scan.rootPath}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-gray-600 dark:text-slate-300">
                            <span className="inline-flex items-center gap-1 font-semibold">
                                <Files size={12} />
                                {scan.totalCount} {t.folderFilesUnit}
                            </span>
                            <span>·</span>
                            <span className="font-semibold">{formatBytes(scan.totalBytes)}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                                <FileVideo size={12} /> {scan.videoCount}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <ImageIcon size={12} /> {scan.imageCount}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onReset}
                        disabled={isProcessing}
                        title={t.folderPickAnother}
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                        <RefreshCw size={12} />
                    </button>
                </div>
            </div>

            {/* 파일 리스트 */}
            <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        {t.folderScannedFiles}
                    </h2>
                </div>
                {files.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-slate-500 py-8 text-center">
                        {t.folderEmpty}
                    </p>
                ) : (
                    <ul className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                        {files.map((f) => (
                            <li
                                key={f.id}
                                className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 px-2.5 py-2"
                            >
                                <FileIcon size={14} className="shrink-0 text-gray-400 dark:text-slate-500" />
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-gray-900 dark:text-white truncate" title={f.path}>
                                        {f.name}
                                    </div>
                                    <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate">
                                        {formatBytes(f.originalSize)}
                                        {f.status === 'processing' && f.progress > 0
                                            ? ` · ${Math.round(f.progress)}%`
                                            : ''}
                                    </div>
                                </div>
                                <StatusBadge status={f.status} language={language} />
                                {!isProcessing && f.status === 'queued' && (
                                    <button
                                        onClick={() => onRemoveFile(f.id)}
                                        className="shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                                        title={t.folderExcludeTooltip}
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

// App.tsx에서 드롭 이벤트 처리 시 활용 — 드롭 경로 중 처음으로 만난 디렉토리를 스캔 대상으로 사용.
// 현재는 App에서 직접 invoke → 이 함수는 참조용 export.
export async function resolveDroppedFolder(
    paths: string[],
    invokeFn: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>
): Promise<string | null> {
    for (const p of paths) {
        try {
            // scan_folder_media는 디렉토리 아니면 에러 → 성공하면 폴더.
            await invokeFn('scan_folder_media', { rootPath: p });
            return p;
        } catch {
            // 파일이거나 권한 없음 — 다음 경로 시도.
        }
    }
    return null;
}
