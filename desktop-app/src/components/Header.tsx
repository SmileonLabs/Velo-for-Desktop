import React from 'react';
import {
    Moon, Sun, KeyRound, ExternalLink
} from 'lucide-react';
import { Language } from '../types';

interface HeaderProps {
    theme: 'light' | 'dark';
    setTheme: (t: 'light' | 'dark') => void;
    language: Language;
    setLanguage: (l: Language) => void;
    onLicenseButtonClick: () => void;
    isActivated: boolean;
}

export const Header: React.FC<HeaderProps> = ({ theme, setTheme, language, setLanguage, onLicenseButtonClick, isActivated }) => {
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
                {!isActivated ? (
                    <button
                        onClick={onLicenseButtonClick}
                        className="inline-flex items-center gap-2 rounded-lg border border-primary-200/80 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 shadow-sm transition-colors hover:bg-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-primary-700/60 dark:hover:bg-slate-800 dark:hover:text-primary-300"
                    >
                        <KeyRound size={14} />
                        {language === 'ko' ? '라이선스 키 등록하기' : 'Register License Key'}
                    </button>
                ) : (
                    <button
                        onClick={onLicenseButtonClick}
                        className="inline-flex items-center gap-2 rounded-lg border border-primary-200/80 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 shadow-sm transition-colors hover:bg-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-primary-700/60 dark:hover:bg-slate-800 dark:hover:text-primary-300"
                    >
                        <KeyRound size={14} />
                        {language === 'ko' ? '라이센스 관리' : 'License Management'}
                    </button>
                )}

                {/* Language Selector */}
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-900 p-1 rounded-full border border-gray-200 dark:border-slate-800">
                    <button
                        onClick={() => setLanguage('en')}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${language === 'en'
                            ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-300 shadow-sm'
                            : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                    >
                        EN
                    </button>
                    <button
                        onClick={() => setLanguage('ko')}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${language === 'ko'
                            ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-300 shadow-sm'
                            : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                    >
                        한국어
                    </button>
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
