import React, { useEffect, useState, useCallback } from 'react';
import { X, Smartphone, RefreshCw, Wifi, AlertCircle, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Language } from '../types';
import { WifiDirectPairModal } from './WifiDirectPairModal';

// 디바이스 연결 모달 — mDNS LAN 발견을 메인 흐름으로, WiFi Direct는 보조.
//
// 구조:
//   1) 발견된 기기 리스트 (mDNS browse, 1.5s polling)
//   2) WiFi Direct 보조 — adapter 있을 때만 (Windows + WiFi 카드 있음)
//   3) 안내 — 같은 공유기에 연결돼 있나요?

interface DiscoveredDevice {
    deviceId: string;
    deviceName: string;
    ip: string;
    port: number;
    version: string;
}

interface DeviceConnectModalProps {
    isOpen: boolean;
    onClose: () => void;
    language: Language;
    wifiDirectSupported: boolean;
}

export const DeviceConnectModal: React.FC<DeviceConnectModalProps> = ({
    isOpen, onClose, language, wifiDirectSupported,
}) => {
    const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
    const [isStarting, setIsStarting] = useState(true);
    const [showWifiDirect, setShowWifiDirect] = useState(false);

    const ko = language === 'ko';
    const t = (k: string, e: string) => (ko ? k : e);

    // 모달 열릴 때 browser 시작 + 1.5초 간격 polling.
    // browser는 idempotent라 중복 호출 안전.
    const refresh = useCallback(async () => {
        try {
            const list = await invoke<DiscoveredDevice[]>('discover_devices');
            setDevices(list);
        } catch (err) {
            console.warn('[DeviceConnect] discover_devices failed', err);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        let intervalId: number | undefined;

        const init = async () => {
            setIsStarting(true);
            try {
                await invoke('start_device_discovery');
            } catch (err) {
                console.warn('[DeviceConnect] start_device_discovery failed', err);
            }
            if (cancelled) return;
            await refresh();
            setIsStarting(false);
            // 1.5초 polling — mDNS는 보통 수 초 안에 응답이 모임.
            intervalId = window.setInterval(refresh, 1500);
        };

        void init();

        return () => {
            cancelled = true;
            if (intervalId !== undefined) window.clearInterval(intervalId);
        };
    }, [isOpen, refresh]);

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-7 shadow-2xl border border-gray-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>

                    <div className="mb-5">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {t('디바이스 연결', 'Connect a device')}
                        </h2>
                        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                            {t(
                                '같은 Wi-Fi에 있는 다른 Velo 기기를 자동으로 찾습니다.',
                                'Auto-discovers other Velo devices on the same Wi-Fi.'
                            )}
                        </p>
                    </div>

                    {/* 1. 발견된 기기 리스트 */}
                    <section className="mb-5">
                        <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                {t('발견된 기기', 'Discovered')}
                            </h3>
                            <button
                                onClick={() => void refresh()}
                                title={t('새로고침', 'Refresh')}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
                            >
                                <RefreshCw size={12} />
                            </button>
                        </div>
                        {isStarting ? (
                            <div className="flex items-center gap-2 py-6 text-xs text-gray-500 dark:text-slate-400">
                                <Loader2 size={14} className="animate-spin" />
                                {t('주변 기기를 찾는 중...', 'Searching nearby devices...')}
                            </div>
                        ) : devices.length === 0 ? (
                            <div className="flex items-start gap-2 rounded-xl bg-gray-50 dark:bg-slate-800/50 px-3 py-3 text-xs text-gray-500 dark:text-slate-400">
                                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-gray-700 dark:text-slate-300">
                                        {t('아직 발견된 기기가 없습니다.', 'No devices found yet.')}
                                    </p>
                                    <p className="mt-1">
                                        {t(
                                            '폰과 데스크탑이 같은 공유기·Wi-Fi에 연결돼 있는지 확인하세요.',
                                            'Make sure both devices share the same router / Wi-Fi.'
                                        )}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {devices.map((d) => (
                                    <li
                                        key={d.deviceId}
                                        className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 p-3"
                                    >
                                        <div className="shrink-0 w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                                            <Smartphone size={16} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                {d.deviceName}
                                            </div>
                                            <div className="text-[11px] text-gray-400 dark:text-slate-500 truncate font-mono">
                                                {d.ip}:{d.port}
                                                {d.version ? ` · v${d.version}` : ''}
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                            {t('연결됨', 'Connected')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* 2. WiFi Direct 보조 — 어댑터 있을 때만 */}
                    {wifiDirectSupported && (
                        <section className="mb-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                {t('보조 — 공유기 없이 연결', 'Fallback — Without router')}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mb-3 leading-relaxed">
                                {t(
                                    'Wi-Fi가 막혀 있거나 공유기가 없을 때, 안드로이드의 "공유기 없이 연결" 기능을 켜고 직접 페어링합니다.',
                                    'If router-less or Wi-Fi blocked, pair directly using Android\'s "Connect without router" mode.'
                                )}
                            </p>
                            <button
                                onClick={() => setShowWifiDirect(true)}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 transition-colors"
                            >
                                <Wifi size={14} />
                                {t('Wi-Fi Direct로 페어링', 'Pair via Wi-Fi Direct')}
                            </button>
                        </section>
                    )}

                    {/* 3. 어댑터 없을 때 안내 */}
                    {!wifiDirectSupported && (
                        <section className="mb-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                            <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
                                {t(
                                    'Wi-Fi 어댑터가 감지되지 않아 Wi-Fi Direct 보조 옵션은 표시되지 않습니다 (랜선 연결 등). 같은 공유기 환경에서 자동 발견됩니다.',
                                    'Wi-Fi adapter not detected, so the Wi-Fi Direct fallback is hidden. Auto-discovery works on the same router.'
                                )}
                            </p>
                        </section>
                    )}
                </div>
            </div>

            {/* 보조 흐름 — WiFi Direct 모달은 그대로 재사용 */}
            <WifiDirectPairModal
                isOpen={showWifiDirect}
                onClose={() => setShowWifiDirect(false)}
                language={language}
            />
        </>
    );
};
