
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import DashboardLayout, { type Tab } from '../components/DashboardLayout';
import LegalModal from '../components/LegalModal';
import SEO from '../components/SEO';
import { Copy, Download, AlertTriangle, Crown, Clock, Key, Check, Zap, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';
import { themeClass } from '../lib/themeClass';
import { getDesktopDownloadUrl } from '../lib/desktopRelease';

// Types
interface License {
    id: string;
    license_key: string;
    status: string;
    created_at: string;
    expires_at?: string | null;
    paid_amount_cents?: number | null;
    paid_currency?: string | null;
    product_type: string;
    product_name?: string;
}

const MyPage = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Explicitly type activeTab with the Tab type imported from DashboardLayout
    // Note: 'history' tab is removed from layout, so we default to 'overview'
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [licenses, setLicenses] = useState<License[]>([]);
    const [loading, setLoading] = useState(true);
    const [copyToast, setCopyToast] = useState<string | null>(null);
    const [resettingDevice, setResettingDevice] = useState(false);
    const [cooldownModal, setCooldownModal] = useState<{ title: string; body: string } | null>(null);
    const [openingPortal, setOpeningPortal] = useState(false);

    // Modal State
    const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
    const [legalModelType, setLegalModalType] = useState<'privacy' | 'terms' | 'contact'>('contact');

    const fetchLicenses = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('licenses')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching licenses:', error.message);
                return;
            }

            setLicenses(data || []);
        } catch (err) {
            console.error('Unexpected error:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        if (!user) {
            navigate('/');
        } else {
            fetchLicenses();
        }
    }, [user, navigate, fetchLicenses]);

    const getLicenseExpiresAt = useCallback((license: License) => {
        if (license.expires_at) return new Date(license.expires_at);
        const created = new Date(license.created_at);
        const fallback = new Date(created);
        fallback.setDate(created.getDate() + 31);
        return fallback;
    }, []);

    const isLicenseLifetime = useCallback((license: License) => {
        if (license.product_type === 'lifetime') return true;
        if (!license.expires_at) return false;
        return new Date(license.expires_at).getFullYear() >= 9999;
    }, []);

    const isLicenseRefunded = (license: License) => license.status === 'refunded';

    const isLicenseActiveNow = useCallback((license: License) => {
        if (isLicenseRefunded(license)) return false;
        if (license.status !== 'active') return false;
        if (isLicenseLifetime(license)) return true;
        return getLicenseExpiresAt(license).getTime() > Date.now();
    }, [getLicenseExpiresAt, isLicenseLifetime]);

    // Helper: Determine main license status
    const getMainLicense = () => {
        if (licenses.length === 0) return null;
        // Prioritize active lifetime > active monthly > newest record
        const activeLifetime = licenses.find((l) => isLicenseActiveNow(l) && isLicenseLifetime(l));
        if (activeLifetime) return activeLifetime;

        const activeMonthly = licenses.find((l) => isLicenseActiveNow(l) && !isLicenseLifetime(l));
        if (activeMonthly) return activeMonthly;

        return licenses[0];
    };

    const mainLicense = getMainLicense();
    const activeLicense = licenses.find((l) => isLicenseActiveNow(l)) || null;
    const isLifetime = activeLicense ? isLicenseLifetime(activeLicense) : false;

    // Calculate Days Left
    const getDaysLeft = (license: License) => {
        const expires = getLicenseExpiresAt(license);
        const diffTime = expires.getTime() - Date.now();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    };

    const daysLeft = activeLicense && !isLifetime ? getDaysLeft(activeLicense) : 0;
    const isRefunded = mainLicense ? isLicenseRefunded(mainLicense) : false;
    const isExpired = Boolean(mainLicense && !isLifetime && !isRefunded && !isLicenseActiveNow(mainLicense));
    const hasActiveLicense = Boolean(activeLicense);

    // Current Plan Logic
    const currentPlanType = hasActiveLicense ? (isLifetime ? 'lifetime' : 'month') : 'free';
    const paidLicense = hasActiveLicense ? activeLicense : null;

    // Theme-driven classes to avoid dark-mode precedence conflicts
    const freeCurrentCardClass = themeClass(theme, 'border-gray-200 bg-gray-50/50 ring-2 ring-gray-200', 'border-gray-700 bg-gray-800/10 ring-2 ring-gray-700');
    const freeTitleClass = currentPlanType === 'free'
        ? (isDark ? 'text-gray-400' : 'text-gray-500')
        : 'text-[var(--text-color)]';
    const freePriceClass = currentPlanType === 'free'
        ? (isDark ? 'text-gray-500' : 'text-gray-400')
        : 'text-[var(--text-color)]';
    const freeButtonDisabledClass = currentPlanType === 'free'
        ? (isDark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-gray-200 border-gray-200 text-gray-500')
        : 'bg-[var(--bg-color)] border-[var(--card-border)] text-[var(--text-muted)] opacity-50';

    const monthCurrentCardClass = themeClass(theme, 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20', 'border-indigo-500 bg-indigo-900/10 ring-2 ring-indigo-500/20');
    const lifetimeCurrentCardClass = themeClass(theme, 'border-amber-400 bg-amber-500/5 ring-2 ring-amber-500/20', 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-500/20');
    const lifetimePriceClass = themeClass(theme, 'text-indigo-600', 'text-indigo-400');

    const lifetimeBoxClass = themeClass(theme, 'bg-indigo-50/70 border-indigo-200/80', 'bg-slate-950/85 border-slate-500/70');
    const lifetimeHeadlineTextClass = themeClass(theme, 'text-indigo-900', 'text-white');

    const faqQuestionClass = isDark ? 'text-indigo-400' : 'text-indigo-600';
    const heroGradientClass = isDark
        ? 'bg-gradient-to-br from-indigo-950 to-[#0f172a]'
        : 'bg-gradient-to-br from-[#0f172a] to-[#1e293b]';
    const tableRowHoverClass = isDark ? 'hover:bg-white/5' : 'hover:bg-black/5';
    const detailButtonHoverClass = isDark ? 'hover:bg-white/5' : 'hover:bg-black/5';
    const expiredAlertClass = isDark
        ? 'bg-red-900/10 border-red-900/20 text-red-400'
        : 'bg-red-50 border-red-100 text-red-600';
    const expiredIconBoxClass = isDark ? 'bg-red-900/30' : 'bg-red-100';
    const legalLinkHoverClass = isDark ? 'hover:text-indigo-400' : 'hover:text-indigo-600';
    const isKo = i18n.language?.toLowerCase().startsWith('ko');
    const heroStatusLabel = isLifetime
        ? (isKo ? '평생 라이선스 활성' : 'Lifetime Active')
        : (isKo ? `활성 상태 (${daysLeft}일 남음)` : `Active (${daysLeft} Days Left)`);
    const heroTitle = isLifetime
        ? (isKo ? '평생 라이선스가 활성화되었습니다.' : 'Your lifetime license is active.')
        : (isKo ? '1개월 라이선스가 활성화되었습니다.' : 'Your monthly license is active.');
    const heroDescription = isLifetime
        ? (isKo ? '한 번 구매로 평생 사용 가능합니다.' : 'One purchase, permanent access.')
        : (isKo ? '만료일까지 무제한 압축을 사용할 수 있습니다.' : 'Unlimited compression is available until expiry.');

    // Actions
    const handleCopy = (key: string) => {
        navigator.clipboard.writeText(key);
        setCopyToast(isKo ? '라이선스 키가 복사되었습니다.' : 'License key copied.');
        setTimeout(() => setCopyToast(null), 1800);
    };

    const handlePayment = (type: 'lifetime' | 'month') => {
        // Prevent payment if already on higher/same plan (simple check)
        if (type === 'month' && isLifetime) return;
        if (type === 'lifetime' && isLifetime) return;

        const checkoutUrl = type === 'month'
            ? import.meta.env.VITE_POLAR_MONTHLY_URL
            : import.meta.env.VITE_POLAR_CHECKOUT_URL;

        if (!checkoutUrl) {
            alert(t('dashboard.payment_not_configured', 'Payment link is not configured.'));
            return;
        }
        const finalUrl = `${checkoutUrl}?customer_email=${encodeURIComponent(user?.email || '')}`;
        window.location.href = finalUrl;
    };

    const handleDownload = async () => {
        const downloadUrl = await getDesktopDownloadUrl() || import.meta.env.VITE_DOWNLOAD_URL;
        if (downloadUrl) {
            window.location.href = downloadUrl;
        } else {
            alert(t('dashboard.download_not_configured', 'Download URL is not configured.'));
        }
    };

    const handleDeviceReset = async () => {
        if (resettingDevice) return;
        setResettingDevice(true);
        try {
            const { data, error } = await supabase.rpc('request_device_reset', { cooldown_days: 14 });
            if (error) throw error;

            const result = (data ?? {}) as {
                ok?: boolean;
                code?: string;
                next_available_at?: string;
            };

            if (result.ok) {
                setCopyToast(isKo ? '기기 변경이 처리되었습니다. 새 기기에서 라이선스를 등록하세요.' : 'Device change completed. Register the license on your new device.');
                return;
            }

            if (result.code === 'cooldown' && result.next_available_at) {
                const nextDate = new Date(result.next_available_at).toLocaleString();
                setCooldownModal({
                    title: isKo ? '기기 변경 제한 안내' : 'Device Change Cooldown',
                    body: isKo
                        ? `기기 변경은 14일마다 1회 가능합니다.\n다음 변경 가능 시각: ${nextDate}`
                        : `Device change is available once every 14 days.\nNext available: ${nextDate}`,
                });
                return;
            }

            if (result.code === 'no_active_device') {
                setCopyToast(isKo ? '현재 연결된 기기가 없습니다.' : 'No active device is currently connected.');
                return;
            }

            if (result.code === 'no_active_license') {
                setCopyToast(isKo ? '활성 라이선스가 없어 기기 변경이 불가합니다.' : 'No active license. Device change is unavailable.');
                return;
            }

            setCopyToast(isKo ? '기기 변경 처리에 실패했습니다.' : 'Failed to process device change.');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setCopyToast(isKo ? `기기 변경 오류: ${message}` : `Device change error: ${message}`);
        } finally {
            setResettingDevice(false);
            setTimeout(() => setCopyToast(null), 2500);
        }
    };

    const openContact = () => {
        setLegalModalType('contact');
        setIsLegalModalOpen(true);
    };

    const handleRefundRequest = () => {
        openContact();
    };

    const openPolarHistory = async () => {
        if (openingPortal) return;
        setOpeningPortal(true);
        try {
            const { data, error } = await supabase.functions.invoke('polar-customer-portal', {
                body: { returnUrl: `${window.location.origin}/mypage` },
            });
            if (error) throw error;

            const portalUrl = data?.portalUrl;
            if (!portalUrl) throw new Error('Portal URL was not returned');
            window.open(portalUrl, '_blank');
        } catch (err) {
            let message = err instanceof Error ? err.message : 'Unknown error';
            if (typeof err === 'object' && err !== null && 'context' in err) {
                const context = (err as { context?: Response }).context;
                if (context) {
                    try {
                        const body = await context.clone().json();
                        if (body?.error) message = String(body.error);
                    } catch {
                        // ignore parse errors and keep original message
                    }
                }
            }
            setCopyToast(isKo ? `포탈 열기 실패: ${message}` : `Failed to open portal: ${message}`);
            setTimeout(() => setCopyToast(null), 2500);
        } finally {
            setOpeningPortal(false);
        }
    };

    const formatPaidAmount = (license: License) => {
        if (typeof license.paid_amount_cents !== 'number' || !license.paid_currency) return null;
        return new Intl.NumberFormat(i18n.language?.startsWith('ko') ? 'ko-KR' : 'en-US', {
            style: 'currency',
            currency: license.paid_currency,
        }).format(license.paid_amount_cents / 100);
    };

    // --- Components for Tabs ---

    const OverviewTab = () => (
        <div className="space-y-16">

            {/* 1. Paid User Hero (Hidden for Free Users) */}
            {hasActiveLicense && (
                <div className={`relative overflow-hidden rounded-[2.5rem] border shadow-2xl transition-all duration-500 border-[var(--card-border)] ${heroGradientClass}`}>
                    {/* Dynamic Background Decor */}
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full -mr-20 -mt-20 pointer-events-none" />

                    <div className="relative z-10 p-8 md:p-12 flex flex-col items-start gap-8 text-white">
                        <div className="max-w-3xl">
                            {/* Interactive Status Badge */}
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border backdrop-blur-md text-xs font-black uppercase tracking-widest mb-6 shadow-sm bg-white/10 border-white/10">
                                {isLifetime ? <><Crown className="w-3 h-3 text-amber-400" /> <span className="text-amber-200">Lifetime VIP</span></>
                                    : <><Clock className="w-3 h-3 text-emerald-400" /> <span className="text-emerald-200">{heroStatusLabel}</span></>}
                            </div>

                            {/* Heading */}
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4 leading-[1.15]">
                                {heroTitle}
                            </h2>
                            <p className="text-lg mb-8 font-medium leading-relaxed max-w-lg text-indigo-200/80">
                                {heroDescription}
                            </p>

                            {/* Action Buttons for Active Users */}
                            <div className="flex flex-wrap gap-4">
                                <button
                                    onClick={handleDownload}
                                    className="px-8 py-4 bg-white text-indigo-950 hover:bg-indigo-50 rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer"
                                >
                                    <Download className="w-5 h-5" /> {isKo ? '앱 다운로드' : 'Download App'}
                                </button>
                                <button
                                    onClick={() => void handleDeviceReset()}
                                    disabled={resettingDevice}
                                    className="px-6 py-4 bg-black/30 text-white hover:bg-black/40 rounded-2xl font-bold transition-all border border-white/20 active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <RefreshCw className={`w-4 h-4 ${resettingDevice ? 'animate-spin' : ''}`} />
                                    {isKo ? '기기 변경' : 'Change Device'}
                                </button>
                                {paidLicense && (
                                    <div className="flex items-center gap-2 p-4 rounded-2xl bg-black/30 border border-white/10 backdrop-blur-md text-white font-mono text-sm font-bold tracking-wider">
                                        <Key className="w-4 h-4 opacity-70" />
                                        <span className="truncate max-w-[200px]">{paidLicense.license_key}</span>
                                        <button onClick={() => handleCopy(paidLicense.license_key)} className="ml-2 hover:text-indigo-300 transition-colors cursor-pointer"><Copy className="w-4 h-4" /></button>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs mt-4 text-indigo-100/80 font-medium">
                                {isKo ? '139MB · Windows 사용 가능 · macOS 출시 예정' : '139MB · Windows available · macOS coming soon'}
                            </p>
                            <p className="text-xs mt-2 text-indigo-100/70 font-medium">
                                {isKo ? '기기 변경은 14일마다 1회 가능합니다. 예외 상황은 contact@smileon.app 으로 문의해 주세요.' : 'Device change is available once every 14 days. For exceptions, contact contact@smileon.app.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Pricing Plans Grid (All Users) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch pt-4">

                {/* Free Plan Card */}
                <div className={`relative p-8 rounded-3xl border backdrop-blur-sm flex flex-col transition-all group shadow-sm 
                    ${currentPlanType === 'free'
                        ? freeCurrentCardClass
                        : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-indigo-500/30'
                    }`}>
                    {currentPlanType === 'free' && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="bg-gray-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg whitespace-nowrap backdrop-blur-sm">
                                {t('pricing.current_plan', 'Current Plan')}
                            </span>
                        </div>
                    )}
                    <div className="mb-6">
                        <h3 className={`text-xl font-bold ${freeTitleClass}`}>
                            {t('pricing.free_title', 'Free Plan')}
                        </h3>
                        <div className="mt-4 flex items-baseline gap-1">
                            <span className={`text-4xl font-black ${freePriceClass}`}>$0</span>
                        </div>
                    </div>
                    <ul className="mb-8 space-y-4 flex-1">
                        <li className="flex items-start gap-3 text-sm font-medium text-[var(--text-muted)]">
                            <Check className="w-5 h-5 text-indigo-500 shrink-0" />
                            <span>{t('pricing.free_ft_1', 'Compress 3 files per day')}</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm font-medium text-[var(--text-muted)]">
                            <Check className="w-5 h-5 text-indigo-500 shrink-0" />
                            <span>{t('pricing.free_ft_2', 'Access all VideoLighter features')}</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm font-medium text-[var(--text-muted)]">
                            <Check className="w-5 h-5 text-indigo-500 shrink-0" />
                            <span>{t('pricing.free_ft_3', '100% Offline Privacy')}</span>
                        </li>
                    </ul>
                    {currentPlanType === 'free' ? (
                        <button
                            onClick={handleDownload}
                            className="w-full py-4 rounded-xl font-bold text-sm border transition-all cursor-pointer bg-[var(--text-color)] text-[var(--bg-color)] border-[var(--text-color)] hover:opacity-90 active:scale-95"
                        >
                            {isKo ? '앱 다운로드' : 'Download App'}
                        </button>
                    ) : (
                        <button
                            disabled={true}
                            className={`w-full py-4 rounded-xl font-bold text-sm border transition-all cursor-default
                                ${freeButtonDisabledClass}`}
                        >
                            {t('pricing.btn_basic', 'Basic Plan')}
                        </button>
                    )}
                </div>

                {/* Monthly Card */}
                <div className={`relative p-8 rounded-3xl border backdrop-blur-sm flex flex-col transition-all group shadow-sm
                    ${currentPlanType === 'month'
                        ? monthCurrentCardClass
                        : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-indigo-500/30'
                    }`}>
                    {currentPlanType === 'month' && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="bg-emerald-500/90 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg whitespace-nowrap backdrop-blur-sm">
                                {t('pricing.current_plan', 'Current Plan')}
                            </span>
                        </div>
                    )}
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-[var(--text-color)]">{t('pricing.monthly_title', 'Monthly Plan')}</h3>
                        <div className="mt-4 flex items-baseline gap-1">
                            <span className="text-4xl font-black text-[var(--text-color)]">${t('pricing.monthly_price')}</span>
                            <span className="text-sm font-bold text-[var(--text-muted)]">/mo</span>
                        </div>
                    </div>
                    <ul className="mb-8 space-y-4 flex-1">
                        <li className="flex items-start gap-3 text-sm font-medium text-[var(--text-muted)]">
                            <Check className="w-5 h-5 text-indigo-500 shrink-0" />
                            <span>{t('pricing.paid_ft_1', 'Unlimited compression')}</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm font-medium text-[var(--text-muted)]">
                            <Check className="w-5 h-5 text-indigo-500 shrink-0" />
                            <span>{t('pricing.free_ft_2', 'Access all VideoLighter features')}</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm font-medium text-[var(--text-muted)]">
                            <Check className="w-5 h-5 text-indigo-500 shrink-0" />
                            <span>{t('pricing.free_ft_3', '100% Offline Privacy')}</span>
                        </li>
                    </ul>
                    <button
                        onClick={() => handlePayment('month')}
                        disabled={isLifetime || currentPlanType === 'month'}
                        className={`w-full py-4 rounded-xl font-bold text-sm border transition-all active:scale-95
                            ${currentPlanType === 'month'
                                ? 'bg-emerald-600 text-white border-emerald-600 cursor-default shadow-lg shadow-emerald-500/20'
                                : isLifetime
                                    ? 'bg-[var(--bg-color)] border-[var(--card-border)] text-[var(--text-muted)] opacity-50 cursor-not-allowed'
                                    : 'bg-[var(--bg-color)] border-[var(--card-border)] text-[var(--text-color)] hover:bg-[var(--text-color)] hover:text-[var(--bg-color)] cursor-pointer'
                            }`}
                    >
                        {currentPlanType === 'month' ? t('pricing.btn_active', 'Active') : (isLifetime ? t('pricing.btn_included', 'Included') : t('pricing.btn_upgrade', 'Upgrade'))}
                    </button>
                </div>

                {/* Lifetime Tier */}
                <div className={`relative p-8 rounded-[2rem] border-2 backdrop-blur-sm flex flex-col transition-all shadow-xl z-0
                     ${currentPlanType === 'lifetime'
                        ? lifetimeCurrentCardClass
                        : 'border-indigo-500 bg-gradient-to-b from-indigo-600/5 to-[var(--card-bg)]'
                    } md:scale-105`}>

                    {currentPlanType === 'lifetime' ? (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg whitespace-nowrap">
                                {t('pricing.current_plan', 'Current Plan')}
                            </span>
                        </div>
                    ) : (
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
                            <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg whitespace-nowrap">
                                {t('pricing.lifetime_best', 'BEST VALUE')}
                            </span>
                        </div>
                    )}

                    <div className="mb-6 text-center">
                        <h3 className="text-2xl font-black text-[var(--text-color)]">{t('pricing.lifetime_title', 'Lifetime License')}</h3>
                        <div className="mt-4 flex items-center justify-center gap-3">
                            <span className="text-lg font-bold text-[var(--text-muted)] line-through opacity-50 block">${t('pricing.lifetime_original')}</span>
                            <span className={`text-4xl font-black ${lifetimePriceClass}`}>${t('pricing.lifetime_price')}</span>
                        </div>
                    </div>

                    <div className={`space-y-3 mb-8 p-4 rounded-2xl border ${lifetimeBoxClass}`}>
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                            <p className={`text-xs font-bold leading-snug ${lifetimeHeadlineTextClass}`}>
                                "{t('pricing.lifetime_desc', 'Pay once, enjoy forever updates')}"
                            </p>
                        </div>
                    </div>

                    <ul className="mb-8 space-y-3 flex-1">
                        <li className="flex items-center gap-3 text-sm font-bold text-[var(--text-color)]">
                            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                                <Check className="w-3 h-3 text-white" />
                            </div>
                            <span>{t('pricing.feature_lifetime', 'One-time Payment')}</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm font-bold text-[var(--text-color)]">
                            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                                <Check className="w-3 h-3 text-white" />
                            </div>
                            <span>{t('pricing.paid_ft_1', 'Unlimited compression')}</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm font-bold text-[var(--text-color)]">
                            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                                <Check className="w-3 h-3 text-white" />
                            </div>
                            <span>{t('pricing.free_ft_2', 'Access all VideoLighter features')}</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm font-bold text-[var(--text-color)]">
                            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                                <Check className="w-3 h-3 text-white" />
                            </div>
                            <span>{t('pricing.free_ft_3', '100% Offline Privacy')}</span>
                        </li>
                    </ul>

                    <button
                        onClick={() => handlePayment('lifetime')}
                        disabled={currentPlanType === 'lifetime'}
                        className={`w-full py-5 rounded-2xl font-black text-lg transition-all shadow-xl flex items-center justify-center gap-2
                             ${currentPlanType === 'lifetime'
                                ? 'bg-amber-500 text-white cursor-default shadow-amber-500/20'
                                : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 shadow-indigo-600/20 cursor-pointer'
                            }`}
                    >
                        {currentPlanType === 'lifetime' ? t('pricing.btn_lifetime_owned', 'Lifetime Owned') : t('pricing.btn_upgrade', 'Upgrade')}
                    </button>
                </div>
            </div>

            {/* Expired License Alert */}
            {isExpired && (
                <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center gap-4 animate-pulse-slow ${expiredAlertClass}`}>
                    <div className={`p-2 rounded-full flex-shrink-0 ${expiredIconBoxClass}`}>
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-lg">{t('status.expired_title', 'License has Expired')}</h4>
                        <p className="text-sm opacity-90 font-medium">{t('status.expired_desc', 'Your 30-day access ended. Renew now to continue using Pro features.')}</p>
                    </div>
                    <button onClick={() => handlePayment('month')} className="px-6 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 whitespace-nowrap active:scale-95">
                        {t('status.renew', 'Renew Access')}
                    </button>
                </div>
            )}
        </div>
    );

    const PurchaseTab = () => (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <p className="text-sm text-[var(--text-muted)]">
                    {isKo ? '구매 내역과 만료 상태를 확인하고 환불 요청을 진행할 수 있습니다.' : 'Review purchase history, expiry status, and request a refund.'}
                </p>
                <button
                    onClick={handleRefundRequest}
                    className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors cursor-pointer"
                >
                    {isKo ? '환불 요청' : 'Request Refund'}
                </button>
            </div>

            <div className="p-8 rounded-[2.5rem] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="text-[var(--text-muted)] text-xs uppercase tracking-widest border-b border-[var(--card-border)]">
                                <th className="pb-6 pl-6 font-black">{t('history.col_date', 'Date')}</th>
                                <th className="pb-6 font-black">{t('history.col_product', 'Plan')}</th>
                                <th className="pb-6 font-black">{t('history.col_expires', 'License Expires')}</th>
                                <th className="pb-6 pr-6 font-black text-right">{t('history.col_action', 'Action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--card-border)]">
                            {licenses.length > 0 ? (
                                licenses.map((l) => {
                                    const created = new Date(l.created_at);
                                    const expires = getLicenseExpiresAt(l);
                                    const isLife = isLicenseLifetime(l);
                                    const refunded = isLicenseRefunded(l);
                                    const expired = !isLife && !refunded && expires.getTime() <= Date.now();

                                    return (
                                        <tr key={l.id} className={`group transition-colors ${tableRowHoverClass}`}>
                                            <td className="py-6 pl-6 text-sm text-[var(--text-color)] font-bold">
                                                {created.toLocaleDateString()}
                                            </td>
                                            <td className="py-6">
                                                <div className="font-bold text-base text-[var(--text-color)]">
                                                    {isLife ? t('pricing.lifetime_title', 'Lifetime License') : t('pricing.monthly_title', 'Monthly Plan')}
                                                </div>
                                                <div className="text-xs text-[var(--text-muted)] font-medium mt-1">
                                                    {formatPaidAmount(l)
                                                        ? `${formatPaidAmount(l)} · ${isLife
                                                            ? (isKo ? '영구 라이선스' : 'Perpetual license')
                                                            : (isKo ? '31일 이용권' : '31-day pass')}`
                                                        : (isLife
                                                            ? (isKo ? '영구 라이선스' : 'Perpetual license')
                                                            : (isKo ? '31일 이용권' : '31-day pass'))}
                                                </div>
                                            </td>
                                            <td className="py-6 text-sm font-bold">
                                                {refunded ? (
                                                    <span className="text-red-500">{t('status.refunded', 'Refunded')}</span>
                                                ) : isLife ? (
                                                    <span className="text-amber-500 flex items-center gap-1"><Crown className="w-3 h-3" /> {t('history.forever', 'Forever')}</span>
                                                ) : expired ? (
                                                    <span className="text-red-500">{t('status.expired', 'Expired')}</span>
                                                ) : (
                                                    <span className="text-[var(--text-muted)]">{expires.toLocaleDateString()} {expires.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                )}
                                            </td>
                                            <td className="py-6 pr-6 text-right">
                                                {refunded ? (
                                                    <span className="inline-flex px-3 py-2 rounded-xl text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                                        {isKo ? '환불됨' : 'Refunded'}
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => void openPolarHistory()}
                                                        disabled={openingPortal}
                                                        className={`px-4 py-2 rounded-xl bg-[var(--bg-color)] border border-[var(--card-border)] text-xs font-bold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${detailButtonHoverClass}`}
                                                    >
                                                        {openingPortal
                                                            ? (isKo ? '여는 중...' : 'Opening...')
                                                            : t('history.btn_detail', 'Detail')}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center opacity-40">
                                            <Clock className="w-8 h-8 mb-3" />
                                            <p className="text-sm font-bold">{t('history.empty', 'No purchase history found.')}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const SupportTab = () => (
        <div className="max-w-4xl mx-auto space-y-12 py-4">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-black mb-4">{t('support.title', 'How can we help?')}</h2>
                <p className="text-[var(--text-muted)] text-lg font-medium">{t('support.subtitle', 'Check our FAQ or contact our support team directly.')}</p>
            </div>

            {/* FAQ Section */}
            <div className="grid gap-6 mb-12">
                <div className="p-8 rounded-[2rem] border border-[var(--card-border)] bg-[var(--card-bg)]">
                    <h3 className="text-xl font-bold mb-6">{t('support.faq_title', 'Frequently Asked Questions')}</h3>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h4 className={`font-bold ${faqQuestionClass}`}>{t('support.faq_activation_q', 'How do I activate my license?')}</h4>
                                <p className="text-sm text-[var(--text-muted)] leading-relaxed whitespace-pre-line">
                                {t('support.faq_activation_a', '1. Enter your license key from the popup shown at first launch.\n2. You can also open License Management in the desktop app and register there.')}
                                </p>
                        </div>
                        <div className="w-full h-px bg-[var(--card-border)]" />
                        <div className="space-y-2">
                            <h4 className={`font-bold ${faqQuestionClass}`}>{t('support.faq_monthly_q', 'Is the Monthly Pass a subscription?')}</h4>
                            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                                {t('support.faq_monthly_a', 'No, it is not a subscription. It is a one-time payment for 31 days of access. It does not auto-renew.')}
                            </p>
                        </div>
                        <div className="w-full h-px bg-[var(--card-border)]" />
                        <div className="space-y-2">
                            <h4 className={`font-bold ${faqQuestionClass}`}>{t('support.faq_device_q', 'Can I use one license on multiple computers?')}</h4>
                            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                                {t('support.faq_device_a', 'One license is valid for one device at a time. If you move PCs, use the PC Move button in My Page to release the current device and activate the new one.')}
                            </p>
                        </div>
                        <div className="w-full h-px bg-[var(--card-border)]" />
                        <div className="space-y-2">
                            <h4 className={`font-bold ${faqQuestionClass}`}>{t('support.faq_email_q', 'I purchased it but haven\'t received the email.')}</h4>
                            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                                {t('support.faq_email_a', 'Please check your spam folder first. If you still can\'t find it, contact support with your payment details and we will resend it immediately.')}
                            </p>
                        </div>
                        <div className="w-full h-px bg-[var(--card-border)]" />
                        <div className="space-y-2">
                            <h4 className={`font-bold ${faqQuestionClass}`}>{t('support.faq_refund_q', 'Can I get a refund?')}</h4>
                            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                                {t('support.faq_refund_a', 'We offer a 100% refund within 14 days if the software does not work due to technical defects that cannot be resolved.')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Contact Support Banner */}
            <div className="p-10 rounded-[2.5rem] bg-indigo-600 text-white text-center shadow-2xl shadow-indigo-600/30 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
                <div className="relative z-10">
                    <h3 className="text-2xl font-black mb-4">{t('support.contact_title', 'Still need assistance?')}</h3>
                    <p className="text-indigo-100 mb-8 max-w-lg mx-auto font-medium text-lg">{t('support.contact_desc', 'Our dedicated support team is ready to help you resolve any issues.')}</p>
                    <button
                        onClick={openContact}
                        className="px-10 py-4 bg-white text-indigo-900 rounded-2xl font-bold hover:bg-indigo-50 transition-colors active:scale-95 shadow-lg cursor-pointer"
                    >
                        {t('support.contact_btn', 'Open Support Ticket')}
                    </button>
                </div>
            </div>

            {/* Legal Links */}
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 pt-4 pb-8">
                <button
                    onClick={() => {
                        setLegalModalType('privacy');
                        setIsLegalModalOpen(true);
                    }}
                    className={`text-[var(--text-muted)] font-bold text-sm transition-colors cursor-pointer ${legalLinkHoverClass}`}
                >
                    {t('legal.privacy_title', 'Privacy Policy')}
                </button>
                <div className="w-px h-4 bg-[var(--card-border)] self-center hidden sm:block" />
                <button
                    onClick={() => {
                        setLegalModalType('terms');
                        setIsLegalModalOpen(true);
                    }}
                    className={`text-[var(--text-muted)] font-bold text-sm transition-colors cursor-pointer ${legalLinkHoverClass}`}
                >
                    {t('legal.terms_title', 'Terms of Service')}
                </button>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'overview': return <OverviewTab />;
            case 'purchase': return <PurchaseTab />;
            case 'support': return <SupportTab />;
            default: return <OverviewTab />;
        }
    };

    return (
        <DashboardLayout
            activeTab={activeTab}
            onTabChange={setActiveTab}
            userEmail={user?.email}
            onLogout={signOut}
        >
            <SEO title={`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} | VideoLighter`} canonicalPath="/mypage" noindex />

            {loading ? (
                <div className="min-h-[500px] flex items-center justify-center">
                    <div className="w-12 h-12 border-[5px] border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                >
                    {renderContent()}
                </motion.div>
            )}

            <LegalModal
                isOpen={isLegalModalOpen}
                onClose={() => setIsLegalModalOpen(false)}
                type={legalModelType}
            />
            {copyToast && (
                <div className="fixed right-6 bottom-6 z-50 px-4 py-3 rounded-xl bg-emerald-600 text-white shadow-xl text-sm font-semibold border border-emerald-400/40">
                    {copyToast}
                </div>
            )}
            {cooldownModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl p-6">
                        <h3 className="text-lg font-black text-[var(--text-color)] mb-3">{cooldownModal.title}</h3>
                        <p className="text-sm whitespace-pre-line text-[var(--text-muted)]">{cooldownModal.body}</p>
                        <div className="mt-5 flex justify-end">
                            <button
                                onClick={() => setCooldownModal(null)}
                                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 cursor-pointer"
                            >
                                {isKo ? '확인' : 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default MyPage;

