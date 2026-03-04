import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface LoginModalProps {
    onClose: () => void;
    onGoogle: () => void;
    onApple: () => void;
    isKo: boolean;
}

const LoginModal = ({ onClose, onGoogle, onApple, isKo }: LoginModalProps) => {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-[400px] overflow-hidden rounded-[2rem] border border-white/20 bg-white/70 dark:bg-[#030712]/70 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-8 flex flex-col items-center gap-8"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Subtle Glow Background */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-[60px] pointer-events-none"></div>
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/20 rounded-full blur-[60px] pointer-events-none"></div>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer z-10"
                    >
                        <X size={20} strokeWidth={2.5} />
                    </button>

                    <div className="text-center w-full z-10 pt-2">
                        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30">
                            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                <polyline points="10 17 15 12 10 7" />
                                <line x1="15" y1="12" x2="3" y2="12" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-black text-[var(--text-color)] mb-2 tracking-tight">
                            {isKo ? '환영합니다' : 'Welcome Back'}
                        </h2>
                        <p className="text-sm font-medium text-[var(--text-muted)]">
                            {isKo ? '소셜 계정으로 안전하게 로그인하세요' : 'Sign in securely with your social account'}
                        </p>
                    </div>

                    <div className="w-full flex flex-col gap-3.5 z-10">
                        <button
                            onClick={() => { onGoogle(); onClose(); }}
                            className="group relative w-full flex items-center justify-center gap-3 py-4 bg-white dark:bg-white/5 text-[var(--text-color)] border border-gray-200 dark:border-white/10 rounded-2xl font-bold cursor-pointer shadow-sm hover:shadow-md hover:border-indigo-500/30 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 overflow-hidden"
                            style={{ willChange: 'transform' }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                            <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            <span className="relative z-10">{isKo ? 'Google로 계속하기' : 'Continue with Google'}</span>
                        </button>

                        <button
                            onClick={() => { onApple(); onClose(); }}
                            className="group relative w-full flex items-center justify-center gap-3 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold cursor-pointer shadow-sm hover:shadow-lg hover:shadow-black/20 dark:hover:shadow-white/20 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
                            style={{ willChange: 'transform' }}
                        >
                            <svg className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                            </svg>
                            <span>{isKo ? 'Apple로 계속하기' : 'Continue with Apple'}</span>
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default LoginModal;
