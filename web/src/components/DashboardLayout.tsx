
import React, { type ReactNode } from 'react';
import {
    LayoutDashboard,
    LogOut,
    Menu,
    X,
    Sun,
    Moon,
    HelpCircle,
    Download,
    ReceiptText
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { getDesktopDownloadUrl } from '../lib/desktopRelease';

export type Tab = 'overview' | 'purchase' | 'support';

interface DashboardLayoutProps {
    children: ReactNode;
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
    userEmail?: string;
    onLogout: () => void;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
    children,
    activeTab,
    onTabChange,
    userEmail,
    onLogout
}) => {
    const { t, i18n } = useTranslation();
    const { theme, toggleTheme } = useTheme();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    const logoSrc = theme === 'dark' ? '/Velo_logo_white.svg' : '/Velo_logo_black.svg';
    const isDark = theme === 'dark';

    const userInfoCardClass = isDark
        ? 'bg-[#111827] border-white/5'
        : 'bg-indigo-50 border-indigo-100';
    const userInfoLabelClass = isDark ? 'text-gray-400' : 'text-indigo-500';
    const navInactiveClass = isDark
        ? 'text-gray-400 hover:bg-white/5 hover:text-white'
        : 'text-gray-500 hover:bg-black/5 hover:text-gray-900';
    const sectionDividerClass = isDark ? 'border-white/5' : 'border-[var(--card-border)]';
    const downloadCardClass = isDark
        ? 'bg-[#111827] border-white/5 hover:border-indigo-500/30'
        : 'bg-indigo-50 border-indigo-100 hover:border-indigo-500/30';
    const downloadTitleClass = isDark ? 'text-gray-200' : 'text-indigo-600';
    const downloadMetaClass = isDark ? 'text-gray-400' : 'text-[var(--text-muted)]';
    const footerPanelClass = isDark
        ? 'bg-[#111827] border-white/5'
        : 'bg-slate-50 border-slate-100';
    const themeButtonClass = isDark
        ? 'text-gray-400 hover:text-white hover:bg-white/5'
        : 'text-slate-500 hover:bg-black/5';
    const footerDividerClass = isDark ? 'bg-white/10' : 'bg-slate-200';
    const langInactiveClass = isDark
        ? 'text-gray-500 hover:text-gray-300'
        : 'text-slate-400 hover:text-slate-600';
    const logoutButtonClass = isDark
        ? 'border-white/5 text-gray-400 hover:bg-red-900/10'
        : 'border-slate-200 text-slate-500 hover:bg-red-50';

    const menuItems: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: 'overview', label: t('nav.dashboard', 'Dashboard'), icon: LayoutDashboard },
        { id: 'purchase', label: t('history.title', 'Purchase History'), icon: ReceiptText },
        { id: 'support', label: t('nav.support', 'Support'), icon: HelpCircle },
    ];

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };


    const handleDownloadMac = () => {
        window.location.href = 'https://pub-cabc405cb7a74235aab394987d229813.r2.dev/Velo_1.0.1_universal.dmg';
    };

    const handleDownloadWindows = async () => {
        const downloadUrl = await getDesktopDownloadUrl() || import.meta.env.VITE_DOWNLOAD_URL;
        if (downloadUrl) {
            window.location.href = downloadUrl;
        } else {
            alert(t('dashboard.download_not_configured', 'Download URL is not configured.'));
        }
    };

    return (
        <div className="flex h-screen bg-[var(--bg-color)] text-[var(--text-color)] overflow-hidden font-sans">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed md:relative z-50 h-full w-72 flex-shrink-0 flex flex-col 
                    bg-[var(--sidebar-bg)] border-r border-[var(--card-border)]
                    transition-transform duration-300 ease-in-out
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                `}
            >
                {/* Logo */}
                <div className="h-20 flex items-center px-8 border-b border-[var(--card-border)]">
                    <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <img src={logoSrc} alt="Velo" className="w-8 h-8" />
                        <span className="font-bold text-xl tracking-tight">Velo</span>
                    </Link>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="md:hidden ml-auto p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* User Info (Mobile/Desktop consistent) */}
                <div className="p-6 pb-2">
                    <div className={`p-4 rounded-xl border transition-colors ${userInfoCardClass}`}>
                        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${userInfoLabelClass}`}>{t('dashboard.signed_in_as', 'Signed in as')}</p>
                        <p className="text-sm font-bold truncate text-[var(--text-color)]" title={userEmail}>
                            {userEmail}
                        </p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-4 flex flex-col">
                    <div className="space-y-2">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    onTabChange(item.id);
                                    setIsSidebarOpen(false);
                                }}
                                className={`
                                w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-bold transition-all relative cursor-pointer
                                ${activeTab === item.id
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                        : navInactiveClass
                                    }
                            `}
                            >
                                <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : ''}`} />
                                {item.label}
                                {activeTab === item.id && (
                                    <span className="absolute right-4 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Integrated Download Link in Menu (Bottom Aligned) */}
                    <div className={`mt-auto pt-4 border-t ${sectionDividerClass}`}>
                        <div className={`px-4 py-3 rounded-xl border ${downloadCardClass}`}>
                            <div className={`flex items-center gap-3 mb-2 ${downloadTitleClass}`}>
                                <Download className="w-5 h-5" />
                                <span className="font-bold text-sm">{t('dashboard.menu_download', 'Download App')}</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <button
                                    onClick={handleDownloadMac}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${downloadMetaClass}`}
                                >
                                    <span>🍎 macOS</span>
                                    <span className="opacity-60">126MB</span>
                                </button>
                                <button
                                    onClick={handleDownloadWindows}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${downloadMetaClass}`}
                                >
                                    <span>🪟 Windows</span>
                                    <span className="opacity-60">139MB</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </nav>

                {/* Footer Controls */}
                <div className={`p-4 mx-4 mb-4 rounded-2xl border space-y-4 ${footerPanelClass}`}>
                    <div className="flex items-center justify-between">
                        <button
                            onClick={toggleTheme}
                            className={`p-2 rounded-lg transition-colors cursor-pointer ${themeButtonClass}`}
                            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                        <div className={`h-4 w-px ${footerDividerClass}`} />
                        <div className="flex gap-1">
                            <button
                                onClick={() => changeLanguage('ko')}
                                className={`px-2 py-1 text-xs font-bold rounded transition-colors cursor-pointer ${i18n.language === 'ko' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400' : langInactiveClass}`}
                            >
                                KR
                            </button>
                            <button
                                onClick={() => changeLanguage('en')}
                                className={`px-2 py-1 text-xs font-bold rounded transition-colors cursor-pointer ${i18n.language === 'en' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400' : langInactiveClass}`}
                            >
                                EN
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-4 pb-6">
                    <button
                        onClick={onLogout}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold hover:text-red-500 hover:border-red-200 transition-all cursor-pointer ${logoutButtonClass}`}
                    >
                        <LogOut className="w-4 h-4" />
                        {t('nav.logout', 'Sign Out')}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto h-full relative">
                {/* Mobile Header */}
                <header className="md:hidden flex items-center justify-between p-4 bg-[var(--bg-color)] border-b border-[var(--card-border)] sticky top-0 z-30">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2">
                        <Menu className="w-6 h-6" />
                    </button>
                    <span className="font-bold">{t('nav.dashboard', 'Dashboard')}</span>
                    <div className="w-6" />
                </header>

                <div className="max-w-[1200px] mx-auto p-6 md:p-12">
                    {/* Title */}
                    <div className="mb-10">
                        <h1 className="text-3xl font-black mb-2">{
                            menuItems.find(i => i.id === activeTab)?.label
                        }</h1>
                    </div>

                    <div className="animate-fade-in-up">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;
