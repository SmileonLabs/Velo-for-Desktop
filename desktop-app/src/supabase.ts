import { createClient } from '@supabase/supabase-js';

// Velo 모바일(iOS/Android)과 동일 Supabase 프로젝트 사용 — 유저 계정·구독·피드백 통합.
// 환경변수는 desktop-app/.env에서 주입 (.env.example 참고).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase 환경변수 누락: desktop-app/.env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 필요',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
