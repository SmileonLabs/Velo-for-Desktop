import React from 'react';
import { X, FolderOpen, FileVideo, FileImage, FileIcon, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Language } from '../types';

// 폰에서 받은 파일 내역. SQLite DB(received_files)에서 로드.
// App.tsx에서 DB 조회 결과 + 실시간 이벤트 합쳐 전달.

export interface ReceivedFile {
  contentHash: string;
  fileName: string;
  fileSize: number;
  mediaType?: string | null;
  fromDeviceId?: string | null;
  fromMdnsName?: string | null;
  phoneAssetId?: string | null;
  localPath: string;
  receivedAtMs: number;
}

interface ReceivedFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: ReceivedFile[];
  saveDir: string | null;
  language: Language;
  onFileDeleted: (contentHash: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatTime(ms: number, language: Language): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return language === 'ko' ? `${diffSec}초 전` : `${diffSec}s ago`;
  if (diffSec < 3600) return language === 'ko' ? `${Math.floor(diffSec / 60)}분 전` : `${Math.floor(diffSec / 60)}m ago`;
  return new Date(ms).toLocaleString();
}

function FileTypeIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const videoExts = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v']);
  const imageExts = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'heic', 'heif']);
  const common = { size: 18, className: 'text-gray-500 dark:text-slate-400' };
  if (videoExts.has(ext)) return <FileVideo {...common} />;
  if (imageExts.has(ext)) return <FileImage {...common} />;
  return <FileIcon {...common} />;
}

export const ReceivedFilesModal: React.FC<ReceivedFilesModalProps> = ({
  isOpen, onClose, files, saveDir, language, onFileDeleted,
}) => {
  if (!isOpen) return null;

  const openInFolder = async (path: string) => {
    try {
      await invoke('show_in_folder', { path });
    } catch (err) {
      console.warn('[ReceivedFiles] show_in_folder failed', err);
    }
  };

  const openSaveDir = async () => {
    if (!saveDir) return;
    try {
      await invoke('show_in_folder', { path: saveDir });
    } catch (err) {
      console.warn('[ReceivedFiles] open save dir failed', err);
    }
  };

  const handleDelete = async (f: ReceivedFile) => {
    const confirmText = language === 'ko'
      ? `"${f.fileName}"을(를) 삭제할까요? 디스크 파일 + 기록 둘 다 지워집니다.`
      : `Delete "${f.fileName}"? File on disk + record will be removed.`;
    if (!window.confirm(confirmText)) return;
    try {
      await invoke('delete_received_file', { contentHash: f.contentHash });
      onFileDeleted(f.contentHash);
    } catch (err) {
      console.warn('[ReceivedFiles] delete failed', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-gray-200 dark:border-slate-800 max-h-[80vh] overflow-hidden flex flex-col">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {language === 'ko' ? '폰에서 받은 파일' : 'Received from phone'}
          </h2>
          {saveDir && (
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 truncate font-mono">
              {saveDir}
            </p>
          )}
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-slate-500">
            {files.length}{language === 'ko' ? '건' : ' files'}
          </span>
          {saveDir && (
            <button
              onClick={openSaveDir}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <FolderOpen size={12} />
              {language === 'ko' ? '폴더 열기' : 'Open folder'}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {files.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-slate-500">
              {language === 'ko'
                ? '아직 받은 파일이 없습니다.\n폰에서 "데스크탑 복사"로 보내보세요.'
                : 'No files received yet.\nSend from phone via "Desktop Copy".'}
            </div>
          ) : (
            <ul className="space-y-2">
              {files.map((f) => (
                <li
                  key={f.contentHash}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 p-3"
                >
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                    <FileTypeIcon fileName={f.fileName} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {f.fileName}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {formatBytes(f.fileSize)} · {formatTime(f.receivedAtMs, language)}
                    </div>
                  </div>
                  <button
                    onClick={() => openInFolder(f.localPath)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <FolderOpen size={12} />
                    {language === 'ko' ? '보기' : 'Show'}
                  </button>
                  <button
                    onClick={() => handleDelete(f)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-2 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    title={language === 'ko' ? '삭제' : 'Delete'}
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
