import React, { useEffect, useMemo, useState } from 'react';
import { X, Monitor, RefreshCw, ExternalLink } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { supabase } from '../supabase';
import { Language } from '../types';

interface LicenseStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    language: Language;
    isDark: boolean;
    storedLicenseKey: string | null;
}

type CheckState = {
    loading: boolean;
    deviceId: string;
    isPaid: boolean | null;
    productType: string | null;
    expiresAt: string | null;
};

const maskLicenseKey = (licenseKey: string | null) => {
    if (!licenseKey) return '-';
    if (licenseKey.length <= 8) return licenseKey;
    return `${licenseKey.slice(0, 4)}-****-****-${licenseKey.slice(-4)}`;
};

export const LicenseStatusModal: React.FC<LicenseStatusModalProps> = ({
    isOpen,
    onClose,
    language,
    isDark,
    storedLicenseKey,
}) => {
    const [state, setState] = useState<CheckState>({
        loading: false,
        deviceId: '-',
        isPaid: null,
        productType: null,
        expiresAt: null,
    });

    const t = useMemo(() => {
        return language === 'ko'
            ? {
                title: '내 라이센스 체크',
                status: '상태',
                active: '활성',
                inactive: '미활성',
                key: '라이센스 키',
                device: '현재 PC ID',
                plan: '플랜',
                product: '상품',
                expires: '만료일',
                unlimited: '무제한',
                pcMove: 'PC 이동',
                refresh: '새로고침',
                close: '닫기',
                paid: '유료',
                free: '무료',
                unknown: '확인 중',
            }
            : {
                title: 'My License',
                status: 'Status',
                active: 'Active',
                inactive: 'Inactive',
                key: 'License Key',
                device: 'Current PC ID',
                plan: 'Plan',
                product: 'Product',
                expires: 'Expires At',
                unlimited: 'Unlimited',
                pcMove: 'Move PC',
                refresh: 'Refresh',
                close: 'Close',
                paid: 'Paid',
                free: 'Free',
                unknown: 'Checking',
            };
    }, [language]);

    const runCheck = async () => {
        setState(prev => ({ ...prev, loading: true }));
        try {
            const machineId = await invoke<string>('get_machine_id');

            const quotaResult = await supabase.functions.invoke('check-free-quota', {
                body: { deviceId: machineId, requestedFiles: 1, commit: false, mediaType: 'video' }
            });

            let productType: string | null = null;
            let expiresAt: string | null = null;

            if (storedLicenseKey) {
                const verifyResult = await supabase.functions.invoke('verify-license', {
                    body: { licenseKey: storedLicenseKey, deviceId: machineId }
                });
                if (!verifyResult.error && verifyResult.data?.success) {
                    productType = verifyResult.data?.productType ?? null;
                    expiresAt = verifyResult.data?.expiresAt ?? null;
                }
            }

            setState({
                loading: false,
                deviceId: machineId,
                isPaid: Boolean(quotaResult.data?.isPaid),
                productType,
                expiresAt,
            });
        } catch {
            setState(prev => ({ ...prev, loading: false, isPaid: null }));
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        void runCheck();
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`w-full max-w-lg rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-gray-200 text-gray-900'} shadow-2xl`}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
                    <h3 className="text-sm font-black tracking-wide">{t.title}</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 space-y-3 text-sm">
                    <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-slate-800 px-3 py-2">
                        <span>{t.status}</span>
                        <span className={`font-bold ${state.isPaid ? 'text-green-500' : 'text-amber-500'}`}>
                            {state.isPaid === null ? t.unknown : (state.isPaid ? t.active : t.inactive)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-slate-800 px-3 py-2">
                        <span>{t.plan}</span>
                        <span className="font-bold">{state.isPaid === null ? t.unknown : (state.isPaid ? t.paid : t.free)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-slate-800 px-3 py-2">
                        <span>{t.key}</span>
                        <span className="font-mono text-xs">{maskLicenseKey(storedLicenseKey)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-slate-800 px-3 py-2">
                        <span>{t.device}</span>
                        <span className="font-mono text-xs truncate max-w-[240px] text-right">{state.deviceId}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-slate-800 px-3 py-2">
                        <span>{t.product}</span>
                        <span className="font-bold">{state.productType || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-slate-800 px-3 py-2">
                        <span>{t.expires}</span>
                        <span className="font-bold">{state.expiresAt ? new Date(state.expiresAt).toLocaleString() : t.unlimited}</span>
                    </div>
                </div>

                <div className="px-5 pb-5 pt-1 grid grid-cols-3 gap-2">
                    <button
                        onClick={() => void runCheck()}
                        disabled={state.loading}
                        className="h-10 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold hover:bg-gray-50 dark:hover:bg-slate-900 inline-flex items-center justify-center gap-1"
                    >
                        <RefreshCw size={13} /> {t.refresh}
                    </button>
                    <a
                        href="https://velo.smileon.app/mypage"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-10 rounded-xl bg-primary-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1"
                    >
                        <Monitor size={13} /> {t.pcMove} <ExternalLink size={12} />
                    </a>
                    <button
                        onClick={onClose}
                        className="h-10 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold hover:bg-gray-50 dark:hover:bg-slate-900"
                    >
                        {t.close}
                    </button>
                </div>
            </div>
        </div>
    );
};
