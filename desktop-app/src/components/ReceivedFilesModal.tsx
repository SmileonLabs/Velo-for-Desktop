import React from 'react';
import { X, FolderOpen, FileVideo, FileImage, FileIcon } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Language } from '../types';

// 폰에서 받은 파일 내역. sync_server가 emit하는 'velo://file-received' 이벤트를
// App.tsx에서 누적하고, 이 모달에서 리스트로 표시.

export interface ReceivedFile {
  filename: string;
  size: number;
  hash: string;
  path: string;
  received_at: string; // ISO-8601
}

interface ReceivedFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: ReceivedFile[];
  saveDir: string | null;
  language: Language;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatTime(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  const diffSec = Math.max(0, Math.floor((Date.now() - t.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}초 전`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  return t.toLocaleString();
}

function FileTypeIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const videoExts = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v']);
  const imageExts = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'heic', 'heif']);
  const common = { size: 18, className: 'text-gray-500 dark:text-slate-400' };
  if (videoExts.has(ext)) return <FileVideo {...common} />;
  if (imageExts.has(ext)) return <FileImage {...common} />;
  return <FileIcon {...common} />;
}

export const ReceivedFilesModal: React.FC<ReceivedFilesModalProps> = ({
  isOpen, onClose, files, saveDir, language,
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
                ? '아직 받은 파일이 없습니다.\n폰에서 "데스크탑 동기화"로 보내보세요.'
                : 'No files received yet.\nSend from phone via "Desktop Sync".'}
            </div>
          ) : (
            <ul className="space-y-2">
              {files.map((f, i) => (
                <li
                  key={`${f.hash}-${i}`}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 p-3"
                >
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                    <FileTypeIcon filename={f.filename} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {f.filename}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {formatBytes(f.size)} · {formatTime(f.received_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => openInFolder(f.path)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <FolderOpen size={12} />
                    {language === 'ko' ? '보기' : 'Show'}
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
