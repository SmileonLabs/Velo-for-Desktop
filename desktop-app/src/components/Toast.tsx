import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

// 우상단 스택형 toast. 3초 자동 dismiss + 수동 닫기. file-received 이벤트에 반응.

export interface ToastItem {
  id: string;
  title: string;
  subtitle?: string;
  onClick?: () => void;
}

interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const Toast: React.FC<{ toast: ToastItem; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      onClick={() => {
        toast.onClick?.();
        onDismiss(toast.id);
      }}
      role="button"
      className="pointer-events-auto group relative min-w-[260px] max-w-[340px] cursor-pointer rounded-xl border border-gray-200 bg-white/95 p-3 pr-10 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/95 transition-transform hover:-translate-y-0.5 animate-in slide-in-from-right"
    >
      <div className="flex items-start gap-2.5">
        <div className="shrink-0 mt-0.5 text-emerald-500">
          <CheckCircle2 size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {toast.title}
          </div>
          {toast.subtitle && (
            <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400 truncate">
              {toast.subtitle}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        className="absolute right-2 top-2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        aria-label="Close"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export const ToastStack: React.FC<ToastStackProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
