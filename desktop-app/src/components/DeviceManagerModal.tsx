import React, { useCallback, useEffect, useState } from 'react';
import { X, Laptop, Smartphone, Monitor, Tablet, Trash2, RefreshCw, Check } from 'lucide-react';
import { supabase } from '../supabase';
import { Language } from '../types';

// 내 Velo 계정에 연결된 모든 기기 목록 + 관리 UI.
// - 자동 새로고침 (모달 열릴 때 1회)
// - 기기별 "제거" 버튼 — 명시적 삭제. 현재 기기도 제거 가능 (다음 기동 시 자동 재등록).
// - last_seen_at 기반 "실시간 접속 / N분 전" 라벨

interface DeviceRow {
  id: string;
  device_id: string;
  device_name: string;
  platform: 'ios' | 'android' | 'macos' | 'windows' | 'linux' | string;
  app_version: string | null;
  is_receiver: boolean;
  last_seen_at: string;
}

interface DeviceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  language: Language;
  currentMachineId: string | null;
}

interface Copy {
  title: string;
  subtitle: string;
  empty: string;
  refresh: string;
  remove: string;
  confirmDelete: (name: string) => string;
  currentBadge: string;
  online: string;
  minutesAgo: (n: number) => string;
  hoursAgo: (n: number) => string;
  daysAgo: (n: number) => string;
  loadError: string;
}

// 모바일과 동일 10개국어. 누락 언어는 영어로 fallback.
const COPY: Partial<Record<Language, Copy>> = {
  ko: {
    title: '내 기기',
    subtitle: '이 계정에 연결된 모든 기기 목록입니다.',
    empty: '등록된 기기가 없습니다.',
    refresh: '새로고침',
    remove: '제거',
    confirmDelete: (name) => `"${name}"을(를) 제거할까요? 이 기기에서 다시 로그인하면 자동 재등록됩니다.`,
    currentBadge: '이 기기',
    online: '실시간 접속 중',
    minutesAgo: (n) => `${n}분 전`,
    hoursAgo: (n) => `${n}시간 전`,
    daysAgo: (n) => `${n}일 전`,
    loadError: '기기 목록을 불러오지 못했습니다.',
  },
  en: {
    title: 'My Devices',
    subtitle: 'All devices connected to this account.',
    empty: 'No registered devices.',
    refresh: 'Refresh',
    remove: 'Remove',
    confirmDelete: (name) => `Remove "${name}"? It will re-register automatically on next sign-in.`,
    currentBadge: 'This device',
    online: 'Online',
    minutesAgo: (n) => `${n}m ago`,
    hoursAgo: (n) => `${n}h ago`,
    daysAgo: (n) => `${n}d ago`,
    loadError: 'Failed to load devices.',
  },
};

function PlatformIcon({ platform, size = 18 }: { platform: string; size?: number }) {
  const props = { size, className: 'text-gray-500 dark:text-slate-400' };
  switch (platform) {
    case 'ios':
    case 'android':
      return <Smartphone {...props} />;
    case 'macos':
      return <Laptop {...props} />;
    case 'windows':
      return <Monitor {...props} />;
    case 'linux':
      return <Monitor {...props} />;
    default:
      return <Tablet {...props} />;
  }
}

function formatLastSeen(iso: string, copy: Copy): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 90) return copy.online;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return copy.minutesAgo(min);
  const hr = Math.floor(min / 60);
  if (hr < 24) return copy.hoursAgo(hr);
  const day = Math.floor(hr / 24);
  return copy.daysAgo(day);
}

export const DeviceManagerModal: React.FC<DeviceManagerModalProps> = ({
  isOpen, onClose, userId, language, currentMachineId,
}) => {
  const copy = COPY[language] ?? COPY.en!;
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    const { data, error: fetchErr } = await supabase
      .from('user_devices')
      .select('id, device_id, device_name, platform, app_version, is_receiver, last_seen_at')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false });
    if (fetchErr) {
      setError(copy.loadError);
      setDevices([]);
    } else {
      setDevices((data ?? []) as DeviceRow[]);
    }
    setIsLoading(false);
  }, [userId, copy.loadError]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  const handleDelete = async (device: DeviceRow) => {
    if (!userId) return;
    const confirmed = window.confirm(copy.confirmDelete(device.device_name));
    if (!confirmed) return;
    setDeletingId(device.id);
    const { error: delErr } = await supabase
      .from('user_devices')
      .delete()
      .eq('user_id', userId)
      .eq('id', device.id);
    setDeletingId(null);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setDevices((prev) => prev.filter((d) => d.id !== device.id));
  };

  if (!isOpen) return null;

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

        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{copy.title}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{copy.subtitle}</p>
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400 dark:text-slate-500">{devices.length} / {language === 'ko' ? '대' : 'devices'}</span>
          <button
            onClick={load}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            {copy.refresh}
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {devices.length === 0 && !isLoading ? (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-slate-500">{copy.empty}</div>
          ) : (
            <ul className="space-y-2">
              {devices.map((d) => {
                const isCurrent = currentMachineId && d.device_id === currentMachineId;
                return (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 p-3"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                      <PlatformIcon platform={d.platform} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{d.device_name}</span>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 px-1.5 py-0.5 rounded">
                            <Check size={10} />
                            {copy.currentBadge}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 flex items-center gap-2">
                        <span className="uppercase">{d.platform}</span>
                        <span>·</span>
                        <span>{formatLastSeen(d.last_seen_at, copy)}</span>
                        {d.app_version && (
                          <>
                            <span>·</span>
                            <span>v{d.app_version}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(d)}
                      disabled={deletingId === d.id}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 size={12} />
                      {copy.remove}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
