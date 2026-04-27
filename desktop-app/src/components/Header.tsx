import React, { useEffect, useRef, useState } from 'react';
import {
    Moon, Sun, ExternalLink, LogIn, LogOut, User, Laptop, RefreshCw, Globe, ChevronDown, Check, Wifi
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { Language, LANGUAGES } from '../types';
import { TRANSLATIONS } from '../constants';

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
    // Wi-Fi Direct (Windows 전용) — supported false면 버튼 자체 숨김.
    wifiDirectSupported?: boolean;
    onWifiDirectClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    theme, setTheme, language, setLanguage,
    session, onLoginClick, onLogoutClick, onDevicesClick,
    onReceivedClick, receivedCount,
    wifiDirectSupported, onWifiDirectClick,
}) => {
    const userEmail = session?.user?.email ?? null;
    const t = TRANSLATIONS[language];

    // 커스텀 언어 드롭다운 — 네이티브 <select>는 OS가 마지막 항목 선택 시 위로 띄움.
    // 항상 버튼 아래로 열리도록 수동 popover 구현.
    const [langOpen, setLangOpen] = useState(false);
    const langRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!langOpen) return;
        const onClickOutside = (e: MouseEvent) => {
            if (langRef.current && !langRef.current.contains(e.target as Node)) {
                setLangOpen(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [langOpen]);
    const currentLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

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
                {/* Wi-Fi Direct (Windows 전용) — 안드 P2P 그룹과 자동 페어링 */}
                {wifiDirectSupported && onWifiDirectClick && (
                    <button
                        onClick={onWifiDirectClick}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                        title={language === 'ko' ? 'Wi-Fi Direct 연결' : 'Wi-Fi Direct'}
                    >
                        <Wifi size={14} />
                        <span>Wi-Fi Direct</span>
                    </button>
                )}

                {/* 동기화된 파일 — 라벨 + 회전 화살표 아이콘으로 의미 명확히. 카운트 배지 유지. */}
                <button
                    onClick={onReceivedClick}
                    className="relative inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    title={t.receivedFiles}
                >
                    <RefreshCw size={14} />
                    <span>{t.receivedFiles}</span>
                    {receivedCount > 0 && (
                        <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary-500 text-[10px] font-bold text-white px-1">
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
                            title={t.myDevices}
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
                            title={t.signOut}
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
                        {t.signIn}
                    </button>
                )}

                {/* Language Selector — 10개 언어. 커스텀 popover로 항상 아래로 열림. */}
                <div ref={langRef} className="relative">
                    <button
                        type="button"
                        onClick={() => setLangOpen((v) => !v)}
                        aria-label="Language"
                        aria-expanded={langOpen}
                        className="inline-flex items-center gap-1.5 cursor-pointer bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full pl-2.5 pr-2 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-all"
                    >
                        <Globe size={12} className="text-gray-500 dark:text-slate-400" />
                        <span>{currentLang.native}</span>
                        <ChevronDown size={12} className={`text-gray-500 dark:text-slate-400 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {langOpen && (
                        <ul className="absolute right-0 top-full mt-1 z-50 min-w-[150px] py-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg max-h-[400px] overflow-y-auto">
                            {LANGUAGES.map((l) => {
                                const active = l.code === language;
                                return (
                                    <li key={l.code}>
                                        <button
                                            type="button"
                                            onClick={() => { setLanguage(l.code); setLangOpen(false); }}
                                            className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium transition-colors text-left ${
                                                active
                                                    ? 'text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20'
                                                    : 'text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            <span>{l.native}</span>
                                            {active && <Check size={12} className="text-primary-600 dark:text-primary-300" />}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
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
