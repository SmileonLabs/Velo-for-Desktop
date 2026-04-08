import React, { useState } from 'react';
import {
    Zap, Lock, Key, CheckCircle, AlertCircle, Loader2, Sparkles, MoveRight, HelpCircle, Languages
} from 'lucide-react';
import { Translation, Language } from '../types';
import { invoke } from '@tauri-apps/api/core';
import { supabase } from '../supabase';

interface ActivationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onActivated: (licenseKey: string) => void;
    t: Translation;
    isDark: boolean;
    currentLanguage: Language;
    onLanguageChange: (lang: Language) => void;
}

export const ActivationModal: React.FC<ActivationModalProps> = ({
    isOpen, onClose, onActivated, t, isDark, currentLanguage, onLanguageChange
}) => {
    const [licenseKey, setLicenseKey] = useState('');
    const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    if (!isOpen) return null;

    const handleActivate = async () => {
        const trimmedKey = licenseKey.trim();
        if (!trimmedKey) return;

        setStatus('verifying');
        setErrorMsg('');

        try {
            console.log('Starting activation for key:', trimmedKey);

            // 1. Get Machine ID from Rust side
            let machineId;
            try {
                machineId = await invoke<string>('get_machine_id');
                console.log('Machine ID retrieved:', machineId);
            } catch (invokeErr) {
                console.error('Failed to get machine id:', invokeErr);
                throw new Error('MACHINE_ID_ERROR');
            }

            // 2. Call Supabase Edge Function
            // Make sure the function name here matches exactly what you created in Supabase Dashboard
            console.log('Invoking verify-license Edge Function...');
            const { data, error } = await supabase.functions.invoke('verify-license', {
                body: { licenseKey: trimmedKey, deviceId: machineId }
            });

            if (error) {
                console.error('Supabase Function Call Error:', error);
                // Check if it's a 404 (function not found)
                if (error.message?.includes('404')) {
                    setErrorMsg(currentLanguage === 'ko' ? '인증 서버(Edge Function)를 찾을 수 없습니다. 이름을 확인해주세요.' : 'Auth server not found. Please check function name.');
                } else {
                    setErrorMsg(currentLanguage === 'ko' ? `서버 연결 오류: ${error.message}` : `Server error: ${error.message}`);
                }
                setStatus('error');
                return;
            }

            console.log('Edge Function Response:', data);

            if (!data.success) {
                setStatus('error');
                if (data?.reason === 'MACHINE_LOCKED') {
                    setErrorMsg(t.machineLocked);
                } else {
                    setErrorMsg(t.invalidKey);
                }
                return;
            }

            // 3. Success
            setStatus('success');
            setTimeout(() => {
                onActivated(trimmedKey);
                onClose();
            }, 2000);
        } catch (err: any) {
            console.error('Activation process crashed:', err);
            setStatus('error');
            setErrorMsg(currentLanguage === 'ko' ? `오류가 발생했습니다: ${err.message}` : `An error occurred: ${err.message}`);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className={`relative w-full max-w-md ${isDark ? 'bg-slate-950/90 text-white' : 'bg-white text-slate-900'} rounded-[2.5rem] shadow-2xl border ${isDark ? 'border-slate-800' : 'border-gray-100'} overflow-hidden p-8 pt-12 flex flex-col items-center text-center animate-in zoom-in-95 duration-300`}>

                {/* Language Switcher */}
                <div className="absolute top-6 right-8 flex items-center gap-2">
                    <button
                        onClick={() => onLanguageChange(currentLanguage === 'ko' ? 'en' : 'ko')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${isDark
                                ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-600'
                                : 'bg-gray-50 border-gray-100 text-gray-500 hover:text-gray-900 hover:border-gray-200'
                            }`}
                    >
                        <Languages size={12} />
                        {currentLanguage === 'ko' ? 'English' : '한국어'}
                    </button>
                </div>

                {/* Brand Icon */}
                <div className={`w-20 h-20 rounded-3xl ${isDark ? 'bg-primary-500/20' : 'bg-primary-50'} flex items-center justify-center mb-6 shadow-inner relative group`}>
                    <div className="absolute inset-0 bg-primary-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                    <Zap className="text-primary-500 relative" size={40} strokeWidth={2.5} />
                </div>

                {/* Typography */}
                <h2 className="text-2xl font-black tracking-tighter mb-3 uppercase">
                    {status === 'success' ? t.activationSuccess : t.activateTitle}
                </h2>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'} leading-relaxed px-4 mb-8`}>
                    {t.activateSub}
                </p>

                {/* Input Area */}
                <div className="w-full space-y-4 mb-8">
                    <div className="relative group">
                        <Key className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-600' : 'text-gray-300'} group-focus-within:text-primary-500 transition-colors`} size={18} />
                        <input
                            type="text"
                            placeholder={t.licenseKey}
                            value={licenseKey}
                            onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                            onKeyPress={(e) => e.key === 'Enter' && handleActivate()}
                            disabled={status === 'verifying' || status === 'success'}
                            className={`w-full h-14 pl-12 pr-4 rounded-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-gray-50 border-gray-100'} border-2 focus:border-primary-500 focus:outline-none transition-all font-mono font-bold tracking-widest uppercase placeholder:normal-case placeholder:font-sans placeholder:font-medium placeholder:tracking-normal text-sm`}
                        />
                    </div>

                    {status === 'error' && (
                        <div className="flex flex-col items-center gap-1 justify-center text-red-500 animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2">
                                <AlertCircle size={14} />
                                <span className="text-[11px] font-bold">{errorMsg}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Button */}
                <button
                    onClick={handleActivate}
                    disabled={status === 'verifying' || status === 'success' || !licenseKey}
                    className={`w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-primary-500/20 relative group overflow-hidden ${status === 'success'
                            ? 'bg-green-500 text-white'
                            : 'bg-primary-500 text-white hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    {status === 'verifying' ? (
                        <div className="flex items-center justify-center gap-2">
                            <Loader2 className="animate-spin" size={18} />
                            {t.verifying}
                        </div>
                    ) : status === 'success' ? (
                        <CheckCircle size={22} className="mx-auto" />
                    ) : (
                        t.activateBtn
                    )}
                </button>

                {status !== 'success' && (
                    <button
                        onClick={onClose}
                        disabled={status === 'verifying'}
                        className={`w-full h-12 mt-3 rounded-2xl font-bold text-sm transition-all border cursor-pointer disabled:opacity-60 ${isDark
                            ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        {currentLanguage === 'ko' ? '무료로 사용해보기' : 'Try Free Mode'}
                    </button>
                )}

                {/* Footer Links */}
                <div className="mt-10 flex flex-col gap-3">
                    <a
                        href="https://velo.smileon.app/"
                        target="_blank"
                        className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-gray-400'} hover:text-primary-500 transition-colors flex items-center justify-center gap-1 group`}
                    >
                        {t.buyNow} <MoveRight size={12} className="group-hover:translate-x-1 transition-transform" />
                    </a>
                </div>
            </div>
        </div>
    );
};
