import React, { useState } from 'react';
import { LogIn, X, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';
import { Language } from '../types';

// Velo 계정 로그인 게이트 — 모바일에서 생성한 계정으로 데스크탑 로그인.
// 소셜 로그인 전용 (Google / Apple). 자체 이메일/비번 로그인은 제공 X.
// forced=true 시 닫기 버튼 숨김 — 앱 진입 게이트 모드.

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  forced?: boolean;
}

interface Copy {
  title: string;
  subtitle: string;
  continueGoogle: string;
  continueApple: string;
  errorOAuth: string;
}

const COPY: Record<Language, Copy> = {
  ko: {
    title: 'Velo 시작하기',
    subtitle: '모바일 Velo 앱에서 사용하는 계정으로 계속 진행하세요.',
    continueGoogle: 'Google로 계속하기',
    continueApple: 'Apple로 계속하기',
    errorOAuth: '로그인에 실패했습니다. 잠시 후 다시 시도해주세요.',
  },
  en: {
    title: 'Get started with Velo',
    subtitle: 'Continue with your Velo mobile account.',
    continueGoogle: 'Continue with Google',
    continueApple: 'Continue with Apple',
    errorOAuth: 'Sign-in failed. Please try again.',
  },
};

// 공식 Google 로고 SVG — 4색 (브랜드 가이드 준수)
const GoogleLogo: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);

// 공식 Apple 로고 SVG — 단색 (다크/라이트 모드 따라 currentColor)
const AppleLogo: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 384 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
  </svg>
);

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, language, forced = false }) => {
  const copy = COPY[language];
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setError(null);
    setIsLoading(true);
    try {
      // OAuth는 기본 브라우저에서 진행 → 완료 후 velo://auth-callback#access_token=...로
      // 앱에 리다이렉트. App.tsx의 onOpenUrl 리스너가 토큰을 받아 세션 주입.
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: 'velo://auth-callback' },
      });
      if (oauthError) setError(copy.errorOAuth);
    } catch {
      setError(copy.errorOAuth);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-gray-200 dark:border-slate-800">
        {!forced && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}

        <div className="mb-7">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/20">
            <LogIn className="text-primary-600 dark:text-primary-400" size={22} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{copy.title}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{copy.subtitle}</p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-3 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <GoogleLogo size={18} />
            {copy.continueGoogle}
          </button>
          <button
            type="button"
            onClick={() => handleOAuth('apple')}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 rounded-lg bg-black dark:bg-white py-3 text-sm font-medium text-white dark:text-black hover:bg-gray-900 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <AppleLogo size={18} />
            {copy.continueApple}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-700 dark:text-red-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};
