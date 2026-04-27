import React, { useState } from 'react';
import { X, Wifi, Loader2, Check, AlertCircle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Language } from '../types';

// Wi-Fi Direct 자동 페어링 모달 (Windows 전용).
// 안드 화면에 표시된 SSID/passphrase를 입력하면 OS가 P2P 그룹에 자동 접속.
// 페어링 성공 시 OS가 일반 Wi-Fi처럼 IP 할당받음 → 기존 mDNS·HTTP 흐름이 안드 발견.

interface WifiDirectPairModalProps {
    isOpen: boolean;
    onClose: () => void;
    language: Language;
}

interface WifiDirectPairResult {
    success: boolean;
    message: string;
}

export const WifiDirectPairModal: React.FC<WifiDirectPairModalProps> = ({
    isOpen, onClose, language,
}) => {
    const [ssid, setSsid] = useState('');
    const [passphrase, setPassphrase] = useState('');
    const [isPairing, setIsPairing] = useState(false);
    const [result, setResult] = useState<WifiDirectPairResult | null>(null);

    if (!isOpen) return null;

    const ko = language === 'ko';
    const t = (k: string, e: string) => (ko ? k : e);

    const handlePair = async () => {
        if (!ssid.trim() || !passphrase.trim()) return;
        setIsPairing(true);
        setResult(null);
        try {
            const r = await invoke<WifiDirectPairResult>('wifi_direct_pair', {
                ssid: ssid.trim(),
                passphrase: passphrase.trim(),
            });
            setResult(r);
        } catch (err) {
            setResult({
                success: false,
                message: String(err),
            });
        } finally {
            setIsPairing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-gray-200 dark:border-slate-800">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                    aria-label="Close"
                >
                    <X size={18} />
                </button>

                <div className="mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
                        <Wifi size={22} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {t('Wi-Fi Direct 안드 연결', 'Wi-Fi Direct Pair (Android)')}
                    </h2>
                    <p className="mt-2 text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                        {t(
                            '안드로이드에서 "공유기 없이 연결" 켜면 표시되는 Wi-Fi 이름과 비밀번호를 그대로 입력하세요. 페어링 성공 시 자동으로 같은 네트워크가 되어 동기화 가능합니다.',
                            'Enter the Wi-Fi name and password shown on Android when "Connect without router" is enabled. Once paired, both devices share the same network for sync.'
                        )}
                    </p>
                </div>

                <div className="space-y-3 mb-5">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                            {t('Wi-Fi 이름 (SSID)', 'Network name (SSID)')}
                        </label>
                        <input
                            type="text"
                            value={ssid}
                            onChange={(e) => setSsid(e.target.value)}
                            placeholder="DIRECT-..."
                            disabled={isPairing}
                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                            {t('비밀번호', 'Passphrase')}
                        </label>
                        <input
                            type="text"
                            value={passphrase}
                            onChange={(e) => setPassphrase(e.target.value)}
                            placeholder="••••••••"
                            disabled={isPairing}
                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {result && (
                    <div
                        className={`mb-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${
                            result.success
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                        }`}
                    >
                        {result.success ? <Check size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
                        <span>{result.message}</span>
                    </div>
                )}

                <button
                    onClick={handlePair}
                    disabled={isPairing || !ssid.trim() || !passphrase.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-slate-700 text-white py-3 text-sm font-bold transition-colors"
                >
                    {isPairing ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            {t('연결 중...', 'Pairing...')}
                        </>
                    ) : (
                        t('연결', 'Pair')
                    )}
                </button>

                <p className="mt-4 text-[11px] text-gray-400 dark:text-slate-500 text-center">
                    {t(
                        'Windows 전용 기능. macOS에서는 안드 Wi-Fi 메뉴에서 직접 선택해 주세요.',
                        'Windows only. On macOS, pick the SSID manually from Wi-Fi menu.'
                    )}
                </p>
            </div>
        </div>
    );
};
