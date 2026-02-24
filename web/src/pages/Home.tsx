import { useState, useEffect } from 'react';
import { Zap, Sun, Moon, Menu, Check, Download, Monitor, Lock, MousePointer2, Turtle, CreditCard, HardDrive, HeartOff, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { themeClass } from '../lib/themeClass';
import LegalModal from '../components/LegalModal';
import SEO from '../components/SEO';
import InterfaceShowcase from '../design-test/components/InterfaceShowcase';
import imgHdr from '../assets/features/feature_hdr_vibrant_1770961660749.jpg';
import imgPrivacy from '../assets/features/privacy_security_1770961787193.jpg';
import imgParallel from '../assets/features/feature_parallel_processing_1770961694904.jpg';
import type { User } from '@supabase/supabase-js';

interface NavbarProps {
    user: User | null;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    onDownload?: () => void;
}

interface IconCardProps {
    icon: LucideIcon;
    title: string;
    desc: string;
}

const Navbar = ({ user, signInWithGoogle, signOut, onDownload }: NavbarProps) => {
    const { t, i18n } = useTranslation();
    const { theme, toggleTheme } = useTheme();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-[60] px-4 md:px-6 py-3 md:py-4 transition-all glass border-b border-[var(--card-border)] shadow-sm">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <Link to="/" className="flex items-center gap-2 group cursor-pointer">
                    <div className="w-8 h-8 md:w-10 md:h-10 border rounded-xl md:rounded-2xl flex items-center justify-center transform group-hover:scale-105 transition-transform bg-black border-white/10">
                        <Zap className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </div>
                    <span className="text-lg md:text-xl font-bold tracking-tight text-[var(--text-color)]">VideoLighter</span>
                </Link>

                <div className="hidden md:flex items-center gap-6">
                    <div className="flex items-center gap-6 text-sm font-medium mr-4">
                        <a href="#features" className="transition-colors text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer">{t('nav.features')}</a>
                        <a href="#pricing" className="transition-colors text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer">{t('nav.pricing')}</a>
                    </div>
                    <div className="h-6 w-[1px] bg-[var(--card-border)]"></div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-xl border border-[var(--card-border)] text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--text-color)] transition-all cursor-pointer"
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                        <div className="flex border rounded-xl overflow-hidden p-1 bg-black/5 dark:bg-white/5 border-[var(--card-border)]">
                            <button onClick={() => changeLanguage('ko')} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${i18n.language.startsWith('ko') ? 'bg-indigo-600 text-white' : 'text-[var(--text-muted)]'}`}>KR</button>
                            <button onClick={() => changeLanguage('en')} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${i18n.language.startsWith('en') ? 'bg-indigo-600 text-white' : 'text-[var(--text-muted)]'}`}>EN</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 ml-2">
                        {user ? (
                            <>
                                {onDownload && (
                                    <button onClick={onDownload} className="flex items-center gap-2 text-sm font-black px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all cursor-pointer shadow-lg shadow-indigo-600/20">
                                        <Download className="w-4 h-4" />
                                        {t('hero.download')}
                                    </button>
                                )}
                                <Link to="/mypage" className="text-sm font-bold px-4 py-2 transition-all text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer">{t('nav.dashboard')}</Link>
                                <button onClick={() => signOut()} className="text-sm font-bold px-4 py-2 transition-all text-[var(--text-muted)] hover:text-red-500 cursor-pointer">{t('nav.logout')}</button>
                            </>
                        ) : (
                            <button
                                onClick={() => signInWithGoogle()}
                                className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 transition-all text-[var(--text-color)] bg-[var(--bg-color)] border border-[var(--card-border)] rounded-xl hover:shadow-md hover:border-indigo-500/50 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                {t('nav.login')}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex md:hidden items-center gap-2">
                    <button onClick={toggleTheme} className="p-2 rounded-lg transition-all text-[var(--text-muted)] cursor-pointer">
                        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-lg transition-all text-[var(--text-color)] cursor-pointer">
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {isMenuOpen && (
                <div className="md:hidden absolute top-full left-0 right-0 bg-[var(--bg-color)] border-b border-[var(--card-border)] p-4 flex flex-col gap-4 shadow-xl">
                    <a href="#features" onClick={() => setIsMenuOpen(false)} className="text-sm font-medium p-2 cursor-pointer">{t('nav.features')}</a>
                    <a href="#pricing" onClick={() => setIsMenuOpen(false)} className="text-sm font-medium p-2 cursor-pointer">{t('nav.pricing')}</a>
                    <div className="h-[1px] bg-[var(--card-border)] w-full"></div>

                    <div className="flex items-center justify-between p-2">
                        <span className="text-sm font-medium text-[var(--text-muted)]">Language</span>
                        <div className="flex border rounded-xl overflow-hidden p-1 bg-black/5 dark:bg-white/5 border-[var(--card-border)]">
                            <button onClick={() => changeLanguage('ko')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${i18n.language.startsWith('ko') ? 'bg-indigo-600 text-white' : 'text-[var(--text-muted)]'}`}>한국어</button>
                            <button onClick={() => changeLanguage('en')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${i18n.language.startsWith('en') ? 'bg-indigo-600 text-white' : 'text-[var(--text-muted)]'}`}>English</button>
                        </div>
                    </div>

                    <div className="h-[1px] bg-[var(--card-border)] w-full"></div>
                    {user ? (
                        <>
                            {onDownload && (
                                <button onClick={() => { onDownload(); setIsMenuOpen(false); }} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-black cursor-pointer">
                                    <Download className="w-5 h-5" />
                                    {t('hero.download')}
                                </button>
                            )}
                            <Link to="/mypage" className="text-sm font-bold p-2 text-indigo-500">{t('nav.dashboard')}</Link>
                            <button onClick={() => signOut()} className="text-sm font-bold p-2 text-red-500 text-left cursor-pointer">{t('nav.logout')}</button>
                        </>
                    ) : (
                        <button
                            onClick={() => signInWithGoogle()}
                            className="w-full flex items-center justify-center gap-3 py-3.5 bg-[var(--bg-color)] text-[var(--text-color)] border border-[var(--card-border)] rounded-xl font-bold cursor-pointer shadow-sm active:scale-95 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            {t('nav.login')}
                        </button>
                    )}
                </div>
            )}
        </nav>
    );
};

const FeatureCard = ({ icon: Icon, title, desc }: IconCardProps) => (
    <div className="p-8 rounded-3xl border transition-all group glass border-[var(--card-border)] hover:border-indigo-500/30">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-all bg-indigo-600/10 text-indigo-400">
            <Icon className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold mb-3 text-[var(--text-color)]">{title}</h3>
        <p className="leading-relaxed text-sm text-[var(--text-muted)]">{desc}</p>
    </div>
);

const RecommendCard = ({ icon: Icon, title, desc }: IconCardProps) => (
    <div className="p-8 md:p-10 rounded-[2.5rem] border transition-all glass border-[var(--card-border)] hover:border-indigo-500/30 flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start group">
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl flex items-center justify-center shrink-0 bg-white dark:bg-white/5 shadow-sm border border-[var(--card-border)] group-hover:scale-110 transition-all">
            <Icon className="w-8 h-8 md:w-10 md:h-10 text-indigo-500" />
        </div>
        <div className="space-y-2 md:space-y-3 text-center md:text-left">
            <h3 className="text-xl md:text-2xl font-black text-[var(--text-color)]">{title}</h3>
            <p className="text-sm md:text-lg text-[var(--text-muted)] leading-relaxed font-medium">{desc}</p>
        </div>
    </div>
);

const Home = () => {
    const { user, signInWithGoogle, signOut } = useAuth();
    const { t, i18n } = useTranslation();
    const { theme } = useTheme();
    const navigate = useNavigate();
    const [hasLicense, setHasLicense] = useState(false);
    const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
    const [legalModelType, setLegalModelType] = useState<'privacy' | 'terms' | 'contact'>('privacy');
    const [isFlashing, setIsFlashing] = useState(false);
    const heroBeforeSize = '1.2 GB';
    const heroAfterSize = '320 MB';
    const heroBeforeMb = 1200;
    const heroAfterMb = 320;
    const heroReduction = `-${Math.round(((heroBeforeMb - heroAfterMb) / heroBeforeMb) * 100)}%`;
    const heroSavedAmount = '320MB';

    useEffect(() => {
        if (isFlashing) {
            const timer = setTimeout(() => setIsFlashing(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [isFlashing]);

    useEffect(() => {
        let isMounted = true;

        const loadLicenseState = async () => {
            if (!user?.id) {
                if (isMounted) setHasLicense(false);
                return;
            }

            const { data, error } = await supabase
                .from('licenses')
                .select('id')
                .eq('user_id', user.id)
                .limit(1);

            if (!isMounted) return;
            setHasLicense(!error && !!data && data.length > 0);
        };

        void loadLicenseState();
        return () => {
            isMounted = false;
        };
    }, [user?.id]);

    const handleDownloadClick = () => {
        // Simple macOS/iOS detection
        const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent || navigator.platform || "");
        if (isMac) {
            alert(i18n.language.startsWith('ko')
                ? 'macOS 버전은 현재 준비 중입니다. 출시 소식을 조금만 기다려주세요!'
                : 'macOS version is currently coming soon. Stay tuned for the release!');
            return;
        }
        handleDirectDownload();
    };

    const handleDirectDownload = () => {
        const downloadUrl = import.meta.env.VITE_DOWNLOAD_URL;
        if (downloadUrl) {
            window.location.href = downloadUrl;
        } else {
            alert('Download URL is not configured.');
        }
    };

    const handleFreePlanClick = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setIsFlashing(true);
    };

    const handlePayment = (planType: 'monthly' | 'lifetime') => {
        if (!user) {
            signInWithGoogle();
            return;
        }

        if (hasLicense) {
            navigate('/mypage');
            return;
        }

        let checkoutUrl = '';
        if (planType === 'monthly') {
            checkoutUrl = import.meta.env.VITE_POLAR_MONTHLY_URL;
        } else {
            checkoutUrl = import.meta.env.VITE_POLAR_CHECKOUT_URL; // Default to lifetime or specific env var
        }

        if (!checkoutUrl) {
            alert(`Payment link for ${planType} plan is not configured. Please check .env`);
            console.error(`Missing VITE_POLAR_MONTHLY_URL or VITE_POLAR_CHECKOUT_URL`);
            return;
        }

        const finalUrl = `${checkoutUrl}?customer_email=${encodeURIComponent(user.email || '')}`;
        window.location.href = finalUrl;
    };

    const openLegal = (type: 'privacy' | 'terms' | 'contact') => {
        setLegalModelType(type);
        setIsLegalModalOpen(true);
    };

    const lifetimeHeadlineTextClass = themeClass(theme, 'text-indigo-900', 'text-white');
    const lifetimeSubTextClass = themeClass(theme, 'text-indigo-800', 'text-white');
    const lifetimeBoxClass = themeClass(theme, 'bg-indigo-50/70 border-indigo-200/80', 'bg-slate-950/85 border-slate-500/70');
    const lifetimeDividerClass = themeClass(theme, 'bg-indigo-200/80', 'bg-slate-600/70');
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "VideoLighter",
        "applicationCategory": "MultimediaApplication",
        "operatingSystem": "Windows 10, Windows 11",
        "offers": [
            {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
                "name": "Free Plan"
            },
            {
                "@type": "Offer",
                "price": "3.99",
                "priceCurrency": "USD",
                "name": "1 Month Unlimited"
            },
            {
                "@type": "Offer",
                "price": "14.99",
                "priceCurrency": "USD",
                "name": "Lifetime Pass"
            }
        ]
    };

    return (
        <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] selection:bg-indigo-500/30">
            <SEO canonicalPath="/" structuredData={structuredData} />
            <Navbar
                user={user}
                signInWithGoogle={signInWithGoogle}
                signOut={signOut}
                onDownload={user ? undefined : handleDirectDownload}
            />

            <main className="relative">
                {/* Hero Section */}
                <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 lg:pt-48 lg:pb-40 px-6 overflow-hidden">
                    <div className="absolute top-0 -left-20 w-72 h-72 blur-[120px] rounded-full bg-indigo-600/10 dark:bg-indigo-600/20"></div>
                    <div className="absolute bottom-0 -right-20 w-72 h-72 blur-[120px] rounded-full bg-purple-600/10 dark:bg-purple-600/20"></div>
                    <div className="max-w-[1350px] mx-auto relative z-10">
                        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-12 items-center">
                            <div className="text-center xl:text-left">
                                <motion.h1
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1, duration: 0.8 }}
                                    className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.08] md:leading-[1.1] mb-6 text-[var(--text-color)] tracking-tighter"
                                >
                                    {t('hero.title_new_1')} <br />
                                    <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 dark:from-indigo-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
                                        {t('hero.title_new_2')}
                                    </span>
                                </motion.h1>

                                <motion.p
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-base sm:text-lg md:text-xl max-w-2xl xl:mx-0 mx-auto mb-8 leading-relaxed text-[var(--text-muted)] font-medium"
                                >
                                    {t('hero.subtitle_new')}
                                </motion.p>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="flex flex-col items-center xl:items-start gap-5"
                                >
                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full xl:w-auto">
                                        <button
                                            onClick={handleDownloadClick}
                                            className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-base md:text-lg transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer shadow-xl shadow-indigo-600/30 ${isFlashing ? 'animate-pulse ring-4 ring-indigo-400 ring-offset-2 ring-offset-[var(--bg-color)]' : ''}`}
                                        >
                                            <Zap className="w-6 h-6 fill-current" />
                                            <div className="flex flex-col items-start leading-none">
                                                <span>{t('hero.cta_primary')}</span>
                                                <span className="text-xs font-medium opacity-80 mt-0.5 whitespace-nowrap">Windows Installer (139 MB)</span>
                                            </div>
                                        </button>
                                        <a
                                            href="#pricing"
                                            className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-base md:text-lg transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 bg-[var(--bg-color)] text-[var(--text-color)] border-2 border-[var(--card-border)] hover:border-indigo-500/50 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer shadow-lg"
                                        >
                                            {t('hero.cta_secondary')}
                                        </a>
                                    </div>
                                    <p className="text-xs md:text-sm font-bold text-[var(--text-muted)] opacity-80">
                                        ✨ {t('hero.cta_free_trial')}
                                    </p>
                                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-[11px] md:text-xs font-bold text-amber-700 dark:text-amber-300">
                                        {i18n.language.startsWith('ko')
                                            ? '소중한 동영상 파일, 웹에 함부로 업로드하지 마세요 !'
                                            : "Don't upload your precious video files carelessly to the web!"}
                                    </span>
                                    <div className="flex items-center justify-center gap-3 text-[10px] md:text-xs font-semibold tracking-wide text-[var(--text-muted)] opacity-80">
                                        <span>{t('hero.windows_only')}</span>
                                        <span className="w-1 h-1 rounded-full bg-[var(--text-muted)] opacity-30"></span>
                                        <span className="text-indigo-600 dark:text-indigo-400 opacity-100">{t('hero.macos_waiting')}</span>
                                    </div>
                                </motion.div>
                            </div>

                            <div className="relative w-full max-w-[560px] mx-auto xl:mx-0">
                                <div className="rounded-[28px] overflow-hidden border border-[var(--card-border)] shadow-2xl bg-[var(--bg-secondary)]">
                                    <img src="/assets/img/broadcast_img.png" alt="Video compression preview" className="w-full h-[320px] sm:h-[400px] lg:h-[460px] object-cover" />
                                    <div className="absolute right-4 top-4 rounded-full border border-indigo-300/40 bg-white/90 px-4 py-2 text-sm font-black text-black shadow-md">
                                        {heroBeforeSize} <span className="mx-1 text-black/70">→</span> <span className="text-indigo-600">{heroAfterSize}</span>
                                    </div>
                                </div>
                                <div className="hidden sm:block absolute left-[-20px] top-[64px] w-[280px] rounded-2xl border border-[var(--card-border)] bg-[var(--bg-color)]/95 backdrop-blur-md shadow-xl p-4">
                                    <h4 className="text-base font-black text-[var(--text-color)] mb-3">{i18n.language.startsWith('ko') ? '동영상 압축' : 'Compress Your Video'}</h4>
                                    <div className="space-y-2.5 mb-4">
                                        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
                                            {i18n.language.startsWith('ko') ? '품질: 균형 모드' : 'Quality: Balanced'}
                                        </div>
                                        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
                                            {i18n.language.startsWith('ko') ? '해상도: 1920 × 1080' : 'Resolution: 1920 × 1080'}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-3 py-2 mb-3">
                                        <div className="text-[11px] font-black text-indigo-500">{i18n.language.startsWith('ko') ? '예상 절감' : 'Estimated Saving'}</div>
                                        <div className="text-sm font-black text-[var(--text-color)]">{heroReduction} ({i18n.language.startsWith('ko') ? `약 ${heroSavedAmount} 절약` : `save about ${heroSavedAmount}`})</div>
                                    </div>
                                    <button className="w-full rounded-xl bg-indigo-600 text-white text-sm font-black py-3">
                                        {i18n.language.startsWith('ko') ? '압축 시작하기' : 'Compress Video'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <InterfaceShowcase />

                {/* Recommendation Section (이런 분들에게 추천합니다) */}
                <section className="py-24 md:py-32 px-6 bg-[var(--bg-color)] border-y border-[var(--card-border)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 blur-[150px] rounded-full bg-indigo-600/5 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 blur-[150px] rounded-full bg-purple-600/5 pointer-events-none"></div>

                    <div className="max-w-7xl mx-auto relative z-10">
                        <div className="text-center mb-16 md:mb-24">
                            <h2
                                className="text-3xl md:text-5xl font-black mb-6 text-[var(--text-color)] tracking-tight"
                            >
                                {t('recommend.title')}
                            </h2>
                            <p className="text-[var(--text-muted)] text-lg md:text-xl font-medium">
                                {t('recommend.subtitle')}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                            <RecommendCard
                                icon={CreditCard}
                                title={t('recommend.card1_title')}
                                desc={t('recommend.card1_desc')}
                            />
                            <RecommendCard
                                icon={Turtle}
                                title={t('recommend.card2_title')}
                                desc={t('recommend.card2_desc')}
                            />
                            <RecommendCard
                                icon={HardDrive}
                                title={t('recommend.card3_title')}
                                desc={t('recommend.card3_desc')}
                            />
                            <RecommendCard
                                icon={HeartOff}
                                title={t('recommend.card4_title')}
                                desc={t('recommend.card4_desc')}
                            />
                        </div>
                    </div>
                </section>

                {/* Detailed Features Grid */}
                <section className="pt-16 pb-32 px-6 bg-[var(--bg-secondary)] relative">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                            <FeatureCard icon={Zap} title={t('features.p1_title')} desc={t('features.p1_desc')} />
                            <FeatureCard icon={MousePointer2} title={t('features.p2_title')} desc={t('features.p2_desc')} />
                            <FeatureCard icon={Lock} title={t('features.p3_title')} desc={t('features.p3_desc')} />
                        </div>

                        {/* Section Divider */}
                        <div className="mt-20 md:mt-32 mb-16 md:mb-24 relative">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-[var(--card-border)] opacity-50"></div>
                            </div>
                            <div className="relative flex justify-center">
                                <span className="px-4 md:px-6 bg-[var(--bg-secondary)] text-[9px] md:text-[10px] font-black tracking-[0.3em] text-[var(--text-muted)] uppercase">
                                    Deep Dive into Technology
                                </span>
                            </div>
                        </div>

                        {/* Detailed Specs with Image Placeholders */}
                        <div className="space-y-20 md:space-y-32">
                            {/* Detailed Feature 1: HDR */}
                            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
                                <div className="flex-1 space-y-4 md:space-y-6">
                                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                                        <Sun className="w-6 h-6 md:w-8 md:h-8" />
                                    </div>
                                    <h3 className="text-2xl md:text-4xl font-black">{t('detailed_features.hdr_title')}</h3>
                                    <p className="text-base md:text-lg text-[var(--text-muted)] leading-relaxed font-medium">{t('detailed_features.hdr_desc')}</p>
                                </div>
                                <div className="flex-1 w-full aspect-square md:aspect-video rounded-[2rem] bg-[var(--bg-color)] border border-[var(--card-border)] overflow-hidden shadow-2xl relative group">
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />
                                    <img
                                        src={imgHdr}
                                        alt="HDR Comparison: Standard vs High Dynamic Range"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                    <div className="absolute bottom-6 left-6 right-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 z-20">
                                        <p className="text-white font-bold text-sm bg-black/50 backdrop-blur-md px-3 py-1 rounded-full inline-block border border-white/20">
                                            Original Quality Preserved
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Feature 2: Privacy */}
                            <div className="flex flex-col md:flex-row-reverse items-center gap-8 md:gap-16">
                                <div className="flex-1 space-y-4 md:space-y-6">
                                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                        <Lock className="w-6 h-6 md:w-8 md:h-8" />
                                    </div>
                                    <h3 className="text-2xl md:text-4xl font-black">{t('detailed_features.privacy_title')}</h3>
                                    <p className="text-base md:text-lg text-[var(--text-muted)] leading-relaxed font-medium">{t('detailed_features.privacy_desc')}</p>
                                </div>
                                <div className="flex-1 w-full aspect-square md:aspect-video rounded-[2rem] bg-[var(--bg-color)] border border-[var(--card-border)] overflow-hidden shadow-2xl relative group">
                                    <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 pointer-events-none" />
                                    <img
                                        src={imgPrivacy}
                                        alt="Privacy Focused Architecture"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                    <div className="absolute top-6 right-6 z-20">
                                        <div className="bg-emerald-500/90 text-white text-xs font-black px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-sm flex items-center gap-1.5">
                                            <Lock size={12} />
                                            SECURE LOCAL
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Feature 3: Parallel */}
                            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
                                <div className="flex-1 space-y-4 md:space-y-6">
                                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                        <Monitor className="w-6 h-6 md:w-8 md:h-8" />
                                    </div>
                                    <h3 className="text-2xl md:text-4xl font-black">{t('detailed_features.parallel_title')}</h3>
                                    <p className="text-base md:text-lg text-[var(--text-muted)] leading-relaxed font-medium">{t('detailed_features.parallel_desc')}</p>
                                </div>
                                <div className="flex-1 w-full aspect-square md:aspect-video rounded-[2rem] bg-[var(--bg-color)] border border-[var(--card-border)] overflow-hidden shadow-2xl relative group">
                                    <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 pointer-events-none" />
                                    <img
                                        src={imgParallel}
                                        alt="High Speed Parallel Processing"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                    <div className="absolute bottom-6 left-6 z-20">
                                        <div className="bg-blue-600/90 text-white text-xs font-black px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-sm flex items-center gap-1.5">
                                            <Zap size={12} />
                                            TURBO MODE
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Pricing Section */}
                <section id="pricing" className="py-20 md:py-32 px-6">
                    <div className="max-w-7xl mx-auto text-center mb-16 md:mb-20">
                        <h2 className="text-3xl md:text-5xl font-black mb-6 text-[var(--text-color)] tracking-tight">{t('pricing.title')}</h2>
                        <p className="max-w-xl mx-auto text-[var(--text-muted)] text-base md:text-lg font-medium opacity-80">{t('pricing.desc')}</p>
                    </div>

                    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch pt-8">
                        {/* Free Tier */}
                        <div className="relative p-8 rounded-3xl border border-[var(--pricing-border)] bg-[var(--pricing-bg)] backdrop-blur-sm flex flex-col hover:border-indigo-500/30 transition-all group shadow-sm dark:shadow-none">
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-[var(--pricing-text-sub)] group-hover:text-[var(--text-color)] transition-colors">{t('pricing.free_title')}</h3>
                                <div className="mt-4 flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-[var(--pricing-text-main)]">$0</span>
                                </div>
                                <p className="mt-2 text-sm text-[var(--pricing-text-sub)] leading-relaxed">{t('pricing.free_desc')}</p>
                            </div>
                            <ul className="mb-8 space-y-4 flex-1">
                                <li className="flex items-start gap-3 text-sm font-medium text-[var(--pricing-text-sub)]">
                                    <Check className="w-5 h-5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                                    <span>{t('pricing.free_limit')}</span>
                                </li>
                                <li className="flex items-start gap-3 text-sm font-medium text-[var(--pricing-text-sub)]">
                                    <Check className="w-5 h-5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                                    <span>{t('pricing.feature_all')}</span>
                                </li>
                                <li className="flex items-start gap-3 text-sm font-medium text-[var(--pricing-text-sub)]">
                                    <Check className="w-5 h-5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                                    <span>{t('pricing.feature_privacy')}</span>
                                </li>
                            </ul>
                            <button
                                onClick={handleFreePlanClick}
                                disabled={hasLicense}
                                className={`w-full py-4 rounded-xl font-bold text-sm border transition-all cursor-pointer ${hasLicense
                                    ? 'bg-gray-200 border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500 cursor-not-allowed'
                                    : 'bg-[var(--pricing-btn-bg)] border-[var(--pricing-btn-border)] text-[var(--pricing-btn-text)] hover:bg-[var(--pricing-btn-hover)]'
                                    }`}
                            >
                                {t('pricing.free_cta')}
                            </button>
                        </div>

                        {/* Monthly Tier */}
                        <div className="relative p-8 rounded-3xl border border-[var(--pricing-border)] bg-[var(--pricing-bg)] backdrop-blur-sm flex flex-col hover:border-indigo-500/30 transition-all group shadow-sm dark:shadow-none">
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-[var(--pricing-text-sub)] group-hover:text-[var(--text-color)] transition-colors">{t('pricing.monthly_title')}</h3>
                                <div className="mt-4 flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-[var(--pricing-text-main)]">${t('pricing.monthly_price')}</span>
                                    <span className="text-sm font-bold text-[var(--pricing-text-sub)]">/mo</span>
                                </div>
                                <p className="mt-2 text-sm text-[var(--pricing-text-sub)]">☕ {t('pricing.monthly_desc')}</p>
                            </div>
                            <ul className="mb-8 space-y-4 flex-1">
                                <li className="flex items-start gap-3 text-sm font-medium text-[var(--pricing-text-sub)]">
                                    <Check className="w-5 h-5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                                    <span>{t('pricing.monthly_limit')}</span>
                                </li>
                                <li className="flex items-start gap-3 text-sm font-medium text-[var(--pricing-text-sub)]">
                                    <Check className="w-5 h-5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                                    <span>{t('pricing.feature_all')}</span>
                                </li>
                                <li className="flex items-start gap-3 text-sm font-medium text-[var(--pricing-text-sub)]">
                                    <Check className="w-5 h-5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                                    <span>{t('pricing.feature_privacy')}</span>
                                </li>
                            </ul>
                            <button
                                onClick={() => handlePayment('monthly')}
                                disabled={hasLicense}
                                className={`w-full py-4 rounded-xl font-bold text-sm border transition-all cursor-pointer ${hasLicense
                                    ? 'bg-gray-200 border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500 cursor-not-allowed'
                                    : 'bg-[var(--pricing-btn-bg)] border-[var(--pricing-btn-border)] text-[var(--pricing-btn-text)] hover:bg-[var(--pricing-btn-hover)]'
                                    }`}
                            >
                                {t('pricing.monthly_cta')}
                            </button>
                        </div>

                        {/* Lifetime Tier - Featured */}
                        <div className="relative p-8 rounded-[2rem] border-2 border-indigo-500 bg-gradient-to-b from-indigo-500/5 to-[var(--card-bg)] dark:from-indigo-900/40 dark:to-[#030712] shadow-[0_0_40px_rgba(79,70,229,0.15)] flex flex-col md:scale-110 md:-mt-4 z-10 glass bg-[var(--pricing-bg)]">
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
                                <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg whitespace-nowrap">
                                    {t('pricing.lifetime_best')}
                                </span>
                            </div>

                            <div className="mb-6 text-center">
                                <h3 className="text-2xl font-black text-[var(--text-color)]">{t('pricing.lifetime_title')}</h3>
                                <div className="mt-4 flex items-center justify-center gap-3">
                                    <span className="text-lg font-bold text-[var(--text-muted)] line-through opacity-50 block">${t('pricing.lifetime_original')}</span>
                                    <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400">${t('pricing.lifetime_price')}</span>
                                </div>
                            </div>

                            <div className={`space-y-3 mb-8 p-4 rounded-2xl border ${lifetimeBoxClass}`}>
                                <div className="flex items-start gap-2">
                                    <Zap className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                                    <p className={`text-xs font-bold leading-snug ${lifetimeHeadlineTextClass}`}>
                                        "{t('pricing.lifetime_desc')}"
                                    </p>
                                </div>
                                <div className={`h-[1px] w-full ${lifetimeDividerClass}`}></div>
                                <p className={`text-[10px] font-bold flex items-center gap-2 ${lifetimeSubTextClass}`}>
                                    <Check className="w-3 h-3 text-emerald-500" />
                                    {t('pricing.lifetime_comparison')}
                                </p>
                                <p className={`text-[10px] font-bold flex items-center gap-2 ${lifetimeSubTextClass}`}>
                                    <Check className="w-3 h-3 text-emerald-500" />
                                    {t('pricing.lifetime_cloud')}
                                </p>
                            </div>

                            <ul className="mb-8 space-y-3 flex-1">
                                <li className="flex items-center gap-3 text-sm font-bold text-[var(--text-color)] dark:text-white">
                                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                    <span>{t('pricing.feature_lifetime')}</span>
                                </li>
                                <li className="flex items-center gap-3 text-sm font-bold text-[var(--text-color)] dark:text-white">
                                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                    <span>{t('pricing.feature_all')}</span>
                                </li>
                                <li className="flex items-center gap-3 text-sm font-bold text-[var(--text-color)] dark:text-white">
                                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                    <span>{t('pricing.feature_privacy')}</span>
                                </li>
                            </ul>

                            <button
                                onClick={() => handlePayment('lifetime')}
                                disabled={hasLicense}
                                className={`w-full py-5 rounded-2xl font-black text-lg transition-all shadow-xl flex items-center justify-center gap-2 ${hasLicense
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none dark:bg-gray-800 dark:text-gray-500'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-indigo-600/20'
                                    }`}
                            >
                                {hasLicense ? (
                                    <>
                                        <Check className="w-5 h-5" />
                                        {t('pricing.cta_purchased')}
                                    </>
                                ) : (
                                    t('pricing.lifetime_cta')
                                )}
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="py-12 border-t px-6 text-center border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-black border border-white/10">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-bold tracking-tight text-[var(--text-color)]">VideoLighter</span>
                        </div>

                        <div className="flex gap-8 text-sm font-medium">
                            <button onClick={() => openLegal('privacy')} className="hover:text-indigo-500 transition-colors cursor-pointer">{t('legal.privacy_title')}</button>
                            <button onClick={() => openLegal('terms')} className="hover:text-indigo-500 transition-colors cursor-pointer">{t('legal.terms_title')}</button>
                            <button onClick={() => openLegal('contact')} className="hover:text-indigo-500 transition-colors cursor-pointer">Contact</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{t('footer.contact')}</p>
                        <p className="text-xs font-bold">{t('footer.copyright')}</p>
                    </div>
                </div>
            </footer>

            <LegalModal
                isOpen={isLegalModalOpen}
                onClose={() => setIsLegalModalOpen(false)}
                type={legalModelType}
            />
        </div>
    );
};

export default Home;
