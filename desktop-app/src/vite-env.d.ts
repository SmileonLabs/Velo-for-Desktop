/// <reference types="vite/client" />

// Vite 환경변수 타입 — desktop-app/.env의 VITE_* 키는 모두 여기 선언.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
