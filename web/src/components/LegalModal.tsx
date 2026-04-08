import { X, Copy, Mail, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'privacy' | 'terms' | 'contact';
}

const LegalModal = ({ isOpen, onClose, type }: LegalModalProps) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const handleCopyEmail = () => {
        navigator.clipboard.writeText('contact@smileon.app');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                        className={`relative w-full ${type === 'contact' ? 'max-w-md' : 'max-w-2xl'} max-h-[90vh] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 dark:border-slate-800`}
                    >
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                                {type === 'contact' && <Mail className="w-5 h-5 text-indigo-500" />}
                                {type === 'privacy' && t('legal.privacy_title')}
                                {type === 'terms' && t('legal.terms_title')}
                                {type === 'contact' && t('dashboard.support')}
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl transition-all cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 text-sm text-slate-600 dark:text-slate-300 leading-relaxed custom-scrollbar">
                            {type === 'contact' ? (
                                <div className="space-y-8 py-4">
                                    <div className="text-center space-y-2">
                                        <p className="font-medium text-slate-500">
                                            {t('history.refund_note')}
                                        </p>
                                    </div>

                                    <div className="p-1.5 pl-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] flex items-center gap-3 group transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
                                        <code className="flex-1 font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate">
                                            contact@smileon.app
                                        </code>
                                        <button
                                            onClick={handleCopyEmail}
                                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all active:scale-95 cursor-pointer shadow-lg ${copied
                                                ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 shadow-slate-900/10'
                                                }`}
                                        >
                                            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                            <span className="sm:inline">{copied ? t('dashboard.active') : t('dashboard.copy')}</span>
                                        </button>
                                    </div>

                                </div>
                            ) : type === 'privacy' ? (
                                <div className="space-y-8">
                                    <p className="text-base font-medium">{t('legal.privacy_intro')}</p>

                                    <div className="grid gap-6">
                                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-3">{t('legal.privacy_sec1_title')}</h3>
                                            <ul className="space-y-2 font-medium">
                                                <li className="flex items-start gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" />
                                                    <span>{t('legal.privacy_sec1_item1')}</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" />
                                                    <span>{t('legal.privacy_sec1_item2')}</span>
                                                </li>
                                            </ul>
                                        </div>

                                        <div className="p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/20">
                                            <h3 className="text-lg font-black text-indigo-600 dark:text-indigo-400 mb-3">{t('legal.privacy_sec2_title')}</h3>
                                            <p className="font-bold text-slate-900 dark:text-white mb-2">{t('legal.privacy_sec2_desc1')}</p>
                                            <p>{t('legal.privacy_sec2_desc2')}</p>
                                        </div>

                                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-3">{t('legal.privacy_sec3_title')}</h3>
                                            <p className="font-medium">{t('legal.privacy_sec3_desc')}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    <div className="grid gap-6">
                                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-3">{t('legal.terms_sec1_title')}</h3>
                                            <ul className="space-y-3 font-medium">
                                                <li className="flex items-start gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" />
                                                    <span>{t('legal.terms_sec1_free')}</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" />
                                                    <span>{t('legal.terms_sec1_monthly')}</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" />
                                                    <span>{t('legal.terms_sec1_lifetime')}</span>
                                                </li>
                                            </ul>
                                        </div>

                                        <div className="p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/20">
                                            <h3 className="text-lg font-black text-indigo-600 dark:text-indigo-400 mb-3">{t('legal.terms_sec2_title')}</h3>
                                            <p className="font-bold text-slate-900 dark:text-white mb-2">{t('legal.terms_sec2_desc')}</p>
                                            <ul className="space-y-1.5 text-[0.95em] opacity-90 list-disc list-inside">
                                                <li>{t('legal.terms_sec2_item1')}</li>
                                                <li>{t('legal.terms_sec2_item2')}</li>
                                            </ul>
                                        </div>

                                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-3">{t('legal.terms_sec3_title')}</h3>
                                            <p className="font-medium">{t('legal.terms_sec3_desc')}</p>
                                        </div>

                                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-3">
                                                {t('legal.license_policy_title', 'License Policy Repository')}
                                            </h3>
                                            <a
                                                href="https://github.com/SmileonLabs/Velo"
                                                target="_blank"
                                                rel="noreferrer"
                                                className="font-mono text-sm text-indigo-600 dark:text-indigo-400 break-all hover:underline"
                                            >
                                                https://github.com/SmileonLabs/Velo
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
                            <button
                                onClick={onClose}
                                className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-sm font-black transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-slate-900/10"
                            >
                                {t('legal.close')}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default LegalModal;
