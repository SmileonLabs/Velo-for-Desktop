import React from 'react';
import {
    Moon, Sun, ExternalLink, LogIn, LogOut, User, Laptop, Inbox, Globe, ChevronDown
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { Language, LANGUAGES } from '../types';

interface HeaderProps {
    theme: 'light' | 'dark';
    setTheme: (t: 'light' | 'dark') => void;
    language: Language;
    setLanguage: (l: Language) => void;
    session: Session | null;
    onLoginClick: () => void;
    onLogoutClick: () => void;
    onDevicesClick: () => void;
    onReceivedClick: () => void;
    receivedCount: number;
}

export const Header: React.FC<HeaderProps> = ({
    theme, setTheme, language, setLanguage,
    session, onLoginClick, onLogoutClick, onDevicesClick,
    onReceivedClick, receivedCount,
}) => {
    const userEmail = session?.user?.email ?? null;
    return (
        <header className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-950 flex items-center justify-between px-6 transition-colors duration-300">
            <div className="flex items-center gap-3">
                <img
                    src="/Velo-horizontal.png"
                    alt="Velo"
                    className="h-7 w-auto dark:invert"
                />
                <div className="flex flex-col">
                    <span className="text-[10px] bg-primary-500 text-white px-1.5 py-0.5 rounded-full font-bold w-fit">PRO</span>
                    <a
                        href="https://velo.smileon.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-gray-400 hover:text-primary-500 flex items-center gap-1 transition-colors font-medium"
                    >
                        velo.smileon.app <ExternalLink size={10} />
                    </a>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* 받은 파일 — 로그인 여부 무관하게 항상 표시. 배지로 수신 건수. */}
                <button
                    onClick={onReceivedClick}
                    className="relative inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    title={language === 'ko' ? '받은 파일' : 'Received files'}
                >
                    <Inbox size={14} />
                    {receivedCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary-500 text-[10px] font-bold text-white flex items-center justify-center px-1">
                            {receivedCount}
                        </span>
                    )}
                </button>

                {/* Velo 계정 로그인 / 프로필 — 모바일에서 가입한 계정으로 로그인 */}
                {userEmail ? (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onDevicesClick}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                            title={language === 'ko' ? '내 기기' : 'My devices'}
                        >
                            <Laptop size={14} />
                        </button>
                        <div className="inline-flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-200">
                            <User size={14} />
                            <span className="max-w-[160px] truncate">{userEmail}</span>
                        </div>
                        <button
                            onClick={onLogoutClick}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                            title={language === 'ko' ? '로그아웃' : 'Sign out'}
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onLoginClick}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <LogIn size={14} />
                        {language === 'ko' ? '로그인' : 'Sign in'}
                    </button>
                )}

                {/* Language Selector — 10개 언어 (모바일과 동일 셋트) */}
                <div className="relative">
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as Language)}
                        className="appearance-none cursor-pointer bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full pl-7 pr-8 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                        aria-label="Language"
                    >
                        {LANGUAGES.map((l) => (
                            <option key={l.code} value={l.code}>{l.native}</option>
                        ))}
                    </select>
                    <Globe size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400" />
                    <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400" />
                </div>

                {/* Theme Toggle */}
                <button
                    onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                    aria-label="Toggle Theme"
                >
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>
            </div>
        </header>
    );
};
