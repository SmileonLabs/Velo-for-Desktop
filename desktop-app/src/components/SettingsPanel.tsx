import React from 'react';
import {
    Settings2, Trash2, Sliders, Info,
    Wind, ShieldCheck, Sparkles, Wand2, Monitor, FolderOpen, Zap, Image as ImageIcon
} from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { CompressionSettings, ResolutionPreset, Translation, Language } from '../types';
import { FORMAT_OPTIONS, RESOLUTION_OPTIONS } from '../constants';

interface SettingsPanelProps {
    processingMode: 'video' | 'image';
    onChangeProcessingMode: (mode: 'video' | 'image') => void;
    language: Language;
    settings: CompressionSettings;
    updateSettings: (partial: Partial<CompressionSettings>) => void;
    t: Translation;
    isProcessing: boolean;
    filesCount: number;
    totalSize: number;
    onOpenLegal: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    processingMode,
    onChangeProcessingMode,
    language,
    settings,
    updateSettings,
    t,
    isProcessing,
    filesCount,
    totalSize,
    onOpenLegal,
}) => {

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleSelectFolder = async () => {
        const selected = await openDialog({
            directory: true,
            multiple: false,
            title: t.selectFolder
        });
        if (selected && typeof selected === 'string') {
            updateSettings({ customOutputPath: selected, outputMode: 'Custom' });
        }
    };

    const Tooltip = ({ text }: { text: string }) => (
        <div className="group relative inline-block ml-1 align-middle">
            <Info size={14} className="text-gray-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[11px] rounded shadow-xl z-50">
                {text}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900"></div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-950 p-6 overflow-y-auto no-scrollbar">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6 shrink-0">
                <Settings2 className="text-primary-500" size={20} />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t.settings}</h2>
            </div>

            <div className="space-y-6">
                <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-3">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        {language === 'ko' ? '작업 타입' : 'Task Type'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => onChangeProcessingMode('video')}
                            disabled={isProcessing}
                            className={`rounded-xl px-3 py-2 text-xs font-bold border transition-all ${processingMode === 'video'
                                ? 'bg-white dark:bg-slate-800 border-primary-500 text-primary-600 dark:text-primary-300'
                                : 'bg-transparent border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'} ${isProcessing ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            {language === 'ko' ? '동영상 압축' : 'Video Compression'}
                        </button>
                        <button
                            type="button"
                            onClick={() => onChangeProcessingMode('image')}
                            disabled={isProcessing}
                            className={`rounded-xl px-3 py-2 text-xs font-bold border transition-all ${processingMode === 'image'
                                ? 'bg-white dark:bg-slate-800 border-primary-500 text-primary-600 dark:text-primary-300'
                                : 'bg-transparent border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'} ${isProcessing ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            {language === 'ko' ? '이미지 압축' : 'Image Compression'}
                        </button>
                    </div>
                </div>

                {/* 1. Format & Resolution Card */}
                {processingMode === 'video' && (
                <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <section>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 uppercase tracking-wider">{t.format}</label>
                            <select
                                value={settings.format}
                                onChange={(e) => updateSettings({ format: e.target.value as any })}
                                disabled={isProcessing}
                                className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                            >
                                {FORMAT_OPTIONS.map(fmt => <option key={fmt} value={fmt}>{fmt}</option>)}
                            </select>
                        </section>
                        <section>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 uppercase tracking-wider">{t.resolution}</label>
                            <select
                                value={settings.resolution}
                                onChange={(e) => updateSettings({ resolution: e.target.value as ResolutionPreset })}
                                disabled={isProcessing}
                                className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                            >
                                {RESOLUTION_OPTIONS.map(res => <option key={res} value={res}>{t[res.toLowerCase() as keyof Translation] || res}</option>)}
                            </select>
                        </section>
                        <section className="col-span-2">
                            <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:border-primary-500 transition-all cursor-pointer group mb-1">
                                <div className="flex items-center gap-2 flex-1">
                                    <Monitor size={16} className={`text-gray-400 group-hover:text-primary-500 ${settings.useHighEfficiencyCodec ? 'text-primary-500' : ''}`} />
                                    <div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs font-bold text-gray-700 dark:text-slate-200">{t.highEfficiency}</span>
                                            <Tooltip text={t.highEfficiencyTip} />
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                            {settings.useHighEfficiencyCodec ? 'AV1 (Maximum Compression)' : 'VP9 (Wide Compatibility)'}
                                        </p>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.useHighEfficiencyCodec}
                                    onChange={(e) => updateSettings({ useHighEfficiencyCodec: e.target.checked })}
                                    className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500"
                                />
                            </label>
                            {/* Download Link for AV1 Codec */}
                            {settings.useHighEfficiencyCodec && (
                                <button
                                    type="button"
                                    className="ml-2 text-[10px] text-primary-500 underline hover:text-primary-600 transition-colors flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
                                    onClick={() => {
                                        import('@tauri-apps/plugin-shell').then(({ open }) => {
                                            open('https://apps.microsoft.com/detail/9mvzqvxjbq9v?hl=en-US&gl=US');
                                        });
                                    }}
                                >
                                    {t.downloadCodec} ↗
                                </button>
                            )}
                        </section>
                    </div>

                    {/* Custom Resolution Inputs */}
                    {settings.resolution === 'Custom' && (
                        <div className="animate-in slide-in-from-top-2 duration-200 flex flex-col gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    placeholder="Width"
                                    value={settings.customWidth || ''}
                                    onChange={(e) => updateSettings({ customWidth: parseInt(e.target.value) })}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-lg p-2 text-sm text-center"
                                />
                                <span className="text-gray-400">×</span>
                                <input
                                    type="number"
                                    placeholder="Height"
                                    value={settings.customHeight || ''}
                                    onChange={(e) => updateSettings({ customHeight: parseInt(e.target.value) })}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-lg p-2 text-sm text-center"
                                />
                            </div>
                            <label className={`flex items-center gap-2 cursor-pointer transition-opacity ${filesCount > 1 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={settings.lockAspectRatio}
                                    onChange={(e) => updateSettings({ lockAspectRatio: e.target.checked })}
                                    disabled={filesCount > 1}
                                    className="rounded text-primary-500"
                                />
                                <span className="text-xs text-gray-500">
                                    {t.lockRatio}
                                    {filesCount > 1 && (
                                        <Tooltip text="Batch processing always uses standard scaling." />
                                    )}
                                </span>
                            </label>
                        </div>
                    )}
                </div>
                )}

                {processingMode === 'image' && (
                    <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-2">
                            <ImageIcon size={14} className="text-primary-500" />
                            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                {language === 'ko' ? '이미지 압축 설정' : 'Image Compression Settings'}
                            </label>
                        </div>

                        <section>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                                {language === 'ko' ? '결과 포맷' : 'Output Format'}
                            </label>
                            <select
                                value={settings.imageFormat}
                                onChange={(e) => updateSettings({ imageFormat: e.target.value as 'JPG' | 'PNG' | 'WEBP' })}
                                disabled={isProcessing}
                                className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                            >
                                <option value="JPG">JPG</option>
                                <option value="PNG">PNG</option>
                                <option value="WEBP">WEBP</option>
                            </select>
                        </section>

                        <section>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                    {language === 'ko' ? '품질' : 'Quality'}
                                </label>
                                <span className="text-xs font-bold px-2 py-0.5 bg-primary-500 text-white rounded-full">{settings.imageQuality}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="100"
                                step="1"
                                value={settings.imageQuality}
                                onChange={(e) => updateSettings({ imageQuality: parseInt(e.target.value) })}
                                disabled={isProcessing}
                                className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                            />
                            <p className="mt-2 text-[11px] text-gray-500 dark:text-slate-400">
                                {language === 'ko' ? '원본 비율을 유지한 채 압축합니다.' : 'Compression keeps the original aspect ratio.'}
                            </p>
                        </section>
                    </div>
                )}

                {/* 2. Output Destination Section */}
                <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-800">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                        <FolderOpen size={14} /> {t.outputDest}
                    </label>
                    <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="radio"
                                name="outputMode"
                                checked={settings.outputMode === 'Same'}
                                onChange={() => updateSettings({ outputMode: 'Same' })}
                                className="text-primary-500 focus:ring-0"
                            />
                            <span className="text-sm text-gray-700 dark:text-slate-300">{t.sameAsOriginal}</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="radio"
                                name="outputMode"
                                checked={settings.outputMode === 'Custom'}
                                onChange={handleSelectFolder}
                                className="text-primary-500 focus:ring-0"
                            />
                            <span className="text-sm text-gray-700 dark:text-slate-300">{t.selectFolder}</span>
                        </label>
                        {settings.outputMode === 'Custom' && settings.customOutputPath && (
                            <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-primary-100 dark:border-primary-900/30 overflow-hidden">
                                <p className="text-[10px] text-primary-500 font-bold mb-1 uppercase tracking-tighter">{t.saveTo}</p>
                                <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate dir-rtl text-left">
                                    {settings.customOutputPath}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {processingMode === 'image' && (
                    <div className="grid grid-cols-1 gap-3 pb-8">
                        <div className="group flex flex-col p-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl transition-all">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <Sparkles size={16} className="text-gray-400 group-hover:text-primary-500" />
                                    <div>
                                        <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{t.parallel}</span>
                                        <Tooltip text={t.parallelTip} />
                                    </div>
                                </div>
                                <select
                                    value={settings.parallelLimit}
                                    onChange={(e) => updateSettings({ parallelLimit: parseInt(e.target.value) })}
                                    className="bg-gray-50 dark:bg-slate-800 border-none rounded text-xs font-bold p-1"
                                >
                                    <option value={1}>1</option>
                                    <option value={2}>2</option>
                                    <option value={4}>4</option>
                                    <option value={8}>8</option>
                                </select>
                            </div>
                        </div>

                        <label className="group flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl hover:border-red-500 transition-all cursor-pointer">
                            <div className="flex items-center gap-3">
                                <Trash2 size={16} className="text-gray-400 group-hover:text-red-500" />
                                <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{t.moveToTrash}</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.moveToTrash}
                                onChange={(e) => updateSettings({ moveToTrash: e.target.checked })}
                                className="w-4 h-4 rounded text-primary-500 focus:ring-0"
                            />
                        </label>
                    </div>
                )}

                {processingMode === 'video' && (
                <>
                {/* 3. Compression Quality & Presets */}
                <section className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Sliders size={14} /> {t.quality}
                        </label>
                        <span className="text-xs font-bold px-2 py-0.5 bg-primary-500 text-white rounded-full">Level {settings.compressionLevel}</span>
                    </div>

                    {/* Golden Presets Buttons */}
                    <div className="grid grid-cols-3 gap-2 mb-6">
                        <button
                            onClick={() => updateSettings({
                                compressionLevel: 4,
                                enableTurbo: false,
                                subjectiveVQ: true
                            })}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${settings.compressionLevel === 4 && !settings.enableTurbo
                                ? 'bg-white dark:bg-slate-800 border-primary-500 ring-1 ring-primary-500 shadow-sm'
                                : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-slate-800/50'
                                }`}
                        >
                            <span className="text-xl mb-1">💎</span>
                            <span className="text-[10px] font-bold text-gray-700 dark:text-slate-200">{t.bestQuality}</span>
                        </button>
                        <button
                            onClick={() => updateSettings({
                                compressionLevel: 6,
                                enableTurbo: false,
                                subjectiveVQ: true
                            })}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${settings.compressionLevel === 6 && !settings.enableTurbo
                                ? 'bg-white dark:bg-slate-800 border-primary-500 ring-1 ring-primary-500 shadow-sm'
                                : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-slate-800/50'
                                }`}
                        >
                            <span className="text-xl mb-1">⚖️</span>
                            <span className="text-[10px] font-bold text-gray-700 dark:text-slate-200">{t.balanced}</span>
                        </button>
                        <button
                            onClick={() => updateSettings({
                                compressionLevel: 8,
                                enableTurbo: true,
                                subjectiveVQ: true
                            })}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${settings.compressionLevel >= 8 && settings.enableTurbo
                                ? 'bg-white dark:bg-slate-800 border-primary-500 ring-1 ring-primary-500 shadow-sm'
                                : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-slate-800/50'
                                }`}
                        >
                            <span className="text-xl mb-1">⚡</span>
                            <span className="text-[10px] font-bold text-gray-700 dark:text-slate-200">{t.smallestSize}</span>
                        </button>
                    </div>

                    {/* Description based on preset */}
                    <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                        <p className="text-xs text-center text-gray-600 dark:text-slate-300 font-medium">
                            {settings.compressionLevel <= 4 ? t.bestQualityDesc :
                                settings.compressionLevel >= 8 ? t.smallestSizeDesc : t.balancedDesc}
                        </p>
                    </div>

                    <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={settings.compressionLevel}
                        onChange={(e) => updateSettings({ compressionLevel: parseInt(e.target.value) })}
                        disabled={isProcessing}
                        className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                    />
                    <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                        <span>{t.highQuality}</span>
                        <span>{t.highCompression}</span>
                    </div>

                    {/* Estimation Display */}
                    {filesCount > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-300">
                            {filesCount === 1 ? (
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{t.originalSizeText}</p>
                                        <p className="text-sm font-bold text-gray-600 dark:text-slate-300">{formatBytes(totalSize)}</p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <p className="text-[10px] text-primary-400 uppercase font-bold tracking-widest">{t.estResultText}</p>
                                        <p className="text-sm font-black text-primary-500">
                                            ~{formatBytes(totalSize * (1 - (0.15 + (settings.compressionLevel - 1) * 0.07)))}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-1">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{t.estReductionText}</p>
                                    <div className="flex items-end gap-1">
                                        <span className="text-2xl font-black text-primary-500">
                                            {Math.round((0.15 + (settings.compressionLevel - 1) * 0.07) * 100)}%
                                        </span>
                                        <span className="text-xs font-bold text-primary-400 mb-1">{t.reductionOff}</span>
                                    </div>
                                    <p className="text-[9px] text-gray-400 italic">
                                        {t.batchNote.replace('{count}', filesCount.toString())}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {/* 4. Advanced Toggle Section */}
                <div className="flex items-center gap-2 mt-4 mb-2">
                    <Sparkles className="text-amber-500" size={16} />
                    <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300">{t.advanced}</h3>
                </div>

                <div className="grid grid-cols-1 gap-3 pb-8">
                    {/* Magic Features: Subjective VQ & HDR */}
                    <label className="group flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl hover:border-primary-500 transition-all cursor-pointer">
                        <div className="flex items-center gap-3">
                            <Wand2 size={16} className="text-purple-500 group-hover:scale-110 transition-transform" />
                            <div>
                                <span className="text-sm font-bold text-gray-700 dark:text-slate-200">{t.subjectiveVQ}</span>
                                <Tooltip text={t.subjectiveVQTip} />
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.subjectiveVQ}
                            onChange={(e) => updateSettings({ subjectiveVQ: e.target.checked })}
                            className="w-4 h-4 rounded text-primary-500 focus:ring-0"
                        />
                    </label>

                    <label className="group flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl hover:border-primary-500 transition-all cursor-pointer">
                        <div className="flex items-center gap-3">
                            <Monitor size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
                            <div>
                                <span className="text-sm font-bold text-gray-700 dark:text-slate-200">{t.hdr}</span>
                                <Tooltip text={t.hdrTip} />
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.enableHDR}
                            onChange={(e) => updateSettings({ enableHDR: e.target.checked })}
                            className="w-4 h-4 rounded text-primary-500 focus:ring-0"
                        />
                    </label>

                    {/* Turbo Mode */}
                    <label className="group flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30 rounded-xl hover:border-primary-500 transition-all cursor-pointer ring-1 ring-primary-500/20">
                        <div className="flex items-center gap-3">
                            <Zap size={16} className="text-primary-500 group-hover:scale-110 transition-transform" />
                            <div>
                                <span className="text-sm font-bold text-primary-700 dark:text-primary-300">{t.turbo}</span>
                                <Tooltip text={t.turboTip} />
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.enableTurbo}
                            onChange={(e) => updateSettings({ enableTurbo: e.target.checked })}
                            className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500"
                        />
                    </label>

                    {/* Parallel Processing */}
                    <div className="group flex flex-col p-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <Sparkles size={16} className="text-gray-400 group-hover:text-primary-500" />
                                <div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{t.parallel}</span>
                                    <Tooltip text={t.parallelTip} />
                                </div>
                            </div>
                            <select
                                value={settings.parallelLimit}
                                onChange={(e) => updateSettings({ parallelLimit: parseInt(e.target.value) })}
                                className="bg-gray-50 dark:bg-slate-800 border-none rounded text-xs font-bold p-1"
                            >
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                                <option value={4}>4</option>
                                <option value={8}>8</option>
                            </select>
                        </div>
                    </div>

                    {/* Trash Toggle */}
                    <label className="group flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl hover:border-red-500 transition-all cursor-pointer">
                        <div className="flex items-center gap-3">
                            <Trash2 size={16} className="text-gray-400 group-hover:text-red-500" />
                            <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{t.moveToTrash}</span>
                        </div>
                        <input type="checkbox" checked={settings.moveToTrash} onChange={(e) => updateSettings({ moveToTrash: e.target.checked })} className="w-4 h-4 rounded text-primary-500 focus:ring-0" />
                    </label>
                </div>
                </>
                )}
            </div>

            {/* Footer Legal Link */}
            <div className="mt-auto pt-6 flex justify-center">
                <button
                    onClick={onOpenLegal}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-primary-500 transition-colors uppercase tracking-widest"
                >
                    <ShieldCheck size={12} />
                    {t.legal}
                </button>
            </div>
        </div>
    );
};
