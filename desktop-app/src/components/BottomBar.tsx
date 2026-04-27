import React from 'react';
import { Play, Loader2 } from 'lucide-react';
import { Translation, VideoFile } from '../types';

interface BottomBarProps {
    onStart: () => void;
    isProcessing: boolean;
    totalProgress: number;
    currentFileId: string | null;
    files: VideoFile[];
    t: Translation;
    startDisabled?: boolean;
    statusMessage?: string | null;
}

export const BottomBar: React.FC<BottomBarProps> = ({
    onStart,
    isProcessing,
    totalProgress,
    currentFileId,
    files,
    t,
    startDisabled = false,
    statusMessage = null,
}) => {
    const currentFile = files.find(f => f.id === currentFileId);
    const isAllComplete = files.length > 0 && files.every(f => f.status === 'completed');
    const hasFiles = files.length > 0;

    // Fake ETA calculation for visual
    const remainingFiles = files.filter(f => f.status === 'queued' || f.status === 'processing').length;
    const etaMinutes = Math.ceil((remainingFiles * (100 - (currentFile?.progress || 0))) / 100);

    return (
        <div className="h-24 bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between px-8 gap-8 shrink-0 relative z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">

            {/* Progress Section */}
            <div className="flex-1 max-w-2xl">
                {isProcessing ? (
                    <div className="animate-in fade-in duration-300">
                        <div className="flex justify-between items-end mb-2">
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-0.5">
                                    {t.processing}
                                </span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                                    {currentFile ? currentFile.name : 'Initializing...'}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {Math.round(totalProgress)}%
                                </span>
                                <span className="text-xs text-gray-500 dark:text-slate-400 block">
                                    {t.eta}: ~{etaMinutes} min
                                </span>
                            </div>
                        </div>
                        <div className="h-2 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-primary-600 to-indigo-600 transition-all duration-300 ease-out"
                                style={{ width: `${totalProgress}%` }}
                            ></div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center text-gray-400 dark:text-slate-500">
                        {isAllComplete ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">
                                {t.completed}
                            </span>
                        ) : (
                            <span>{t.readyToProcess.replace('{count}', String(files.length))}</span>
                        )}
                    </div>
                )}
            </div>

            {/* Action Button */}
            <button
                onClick={onStart}
                disabled={startDisabled || !hasFiles || (isAllComplete && !isProcessing)}
                className={`relative overflow-hidden group px-8 py-3.5 rounded-xl font-bold text-white shadow-lg transition-all duration-300 transform active:scale-95 ${isProcessing
                        ? 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 shadow-red-500/20'
                        : startDisabled || !hasFiles || isAllComplete
                            ? 'bg-gray-300 dark:bg-slate-800 cursor-not-allowed text-gray-500 dark:text-slate-600 shadow-none'
                            : 'bg-gradient-to-r from-primary-600 to-indigo-700 hover:from-primary-500 hover:to-indigo-600 hover:shadow-primary-500/30'
                    }`}
            >
                <span className="relative z-10 flex items-center gap-2">
                    {isProcessing ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            {t.stop}
                        </>
                    ) : (
                        <>
                            <Play size={20} fill="currentColor" />
                            {t.start}
                        </>
                    )}
                </span>
            </button>
            {!isProcessing && statusMessage && (
                <div className="absolute left-8 bottom-1 text-xs text-gray-500 dark:text-slate-400">
                    {statusMessage}
                </div>
            )}
        </div>
    );
};
