import React, { useState } from 'react';
import { Mail, Lock, LogIn, X, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';
import { Language } from '../types';

// Velo 계정 로그인 모달 — 모바일에서 생성한 계정으로 데스크탑 로그인.
// Pro 여부 체크는 후속 기능에서 추가. 이 단계는 로그인 / 로그아웃 UI + 세션 관리만.

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

interface Copy {
  title: string;
  subtitle: string;
  continueGoogle: string;
  continueApple: string;
  dividerOr: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  loginBtn: string;
  loggingIn: string;
  errorInvalid: string;
  errorNetwork: string;
  errorOAuth: string;
}

const COPY: Record<Language, Copy> = {
  ko: {
    title: 'Velo 계정 로그인',
    subtitle: '모바일 Velo 앱에서 사용하는 계정으로 로그인하세요.',
    continueGoogle: 'Google로 계속하기',
    continueApple: 'Apple로 계속하기',
    dividerOr: '또는',
    emailLabel: '이메일',
    emailPlaceholder: 'you@example.com',
    passwordLabel: '비밀번호',
    passwordPlaceholder: '••••••••',
    loginBtn: '로그인',
    loggingIn: '로그인 중...',
    errorInvalid: '이메일 또는 비밀번호가 올바르지 않습니다.',
    errorNetwork: '네트워크 오류. 잠시 후 다시 시도해주세요.',
    errorOAuth: '외부 로그인에 실패했습니다.',
  },
  en: {
    title: 'Sign in to Velo',
    subtitle: 'Use your Velo mobile account credentials.',
    continueGoogle: 'Continue with Google',
    continueApple: 'Continue with Apple',
    dividerOr: 'or',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'Password',
    passwordPlaceholder: '••••••••',
    loginBtn: 'Sign in',
    loggingIn: 'Signing in...',
    errorInvalid: 'Invalid email or password.',
    errorNetwork: 'Network error. Please try again.',
    errorOAuth: 'External sign-in failed.',
  },
};

// 공식 Google 로고 SVG — 4색 (구글 브랜드 가이드 준수)
const GoogleLogo: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);

// 공식 Apple 로고 SVG — 단색 (다크/라이트 모드에 따라 currentColor로 색상 변경)
const AppleLogo: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 384 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
  </svg>
);

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, language }) => {
  const copy = COPY[language];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setError(null);
    setIsLoading(true);
    try {
      // Tauri 데스크탑 환경에서 OAuth는 기본 브라우저로 열림. Supabase 콘솔에서 허용 redirect URL에
      // 데스크탑 앱용 custom scheme (예: velo://auth-callback) 등록 필요 — 후속 기능에서 세팅.
      const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider });
      if (oauthError) setError(copy.errorOAuth);
    } catch {
      setError(copy.errorOAuth);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        // Supabase 에러 메시지는 영문 원문. 유저 친화적 번역으로 치환.
        const msg = authError.message.toLowerCase();
        if (msg.includes('invalid') || msg.includes('credentials')) {
          setError(copy.errorInvalid);
        } else {
          setError(copy.errorNetwork);
        }
        return;
      }
      // 성공 시 세션은 Supabase 클라이언트가 자동 저장. onAuthStateChange로 상위 App에 전달.
      setEmail('');
      setPassword('');
      onClose();
    } catch {
      setError(copy.errorNetwork);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-gray-200 dark:border-slate-800">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="mb-6">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/20">
            <LogIn className="text-primary-600 dark:text-primary-400" size={22} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{copy.title}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{copy.subtitle}</p>
        </div>

        {/* OAuth 버튼 — 공식 로고 SVG */}
        <div className="space-y-2 mb-5">
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <GoogleLogo size={18} />
            {copy.continueGoogle}
          </button>
          <button
            type="button"
            onClick={() => handleOAuth('apple')}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 rounded-lg bg-black dark:bg-white py-2.5 text-sm font-medium text-white dark:text-black hover:bg-gray-900 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <AppleLogo size={18} />
            {copy.continueApple}
          </button>
        </div>

        {/* 구분선 */}
        <div className="relative mb-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white dark:bg-slate-900 px-3 text-gray-400 dark:text-slate-500">
              {copy.dividerOr}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-slate-300">
              {copy.emailLabel}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={copy.emailPlaceholder}
                required
                autoFocus
                className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 pl-10 pr-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-slate-300">
              {copy.passwordLabel}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={copy.passwordPlaceholder}
                required
                className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 pl-10 pr-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-700 dark:text-red-300">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !email.trim() || !password}
            className="w-full rounded-lg bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 text-sm font-semibold transition-colors"
          >
            {isLoading ? copy.loggingIn : copy.loginBtn}
          </button>
        </form>
      </div>
    </div>
  );
};
