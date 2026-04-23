import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { supabase } from './supabase';

// 현재 데스크탑을 Supabase user_devices 테이블에 등록/갱신.
// - 로그인 성공 시 1회 호출.
// - 향후 기능 5(HTTP 서버)에서 local_ip, port, mdns_name 필드 추가 예정.
// - is_receiver=true: 데스크탑은 "받는 쪽" 기기.
export async function registerDesktopDevice(userId: string): Promise<void> {
  const machineId = await invoke<string>('get_machine_id');
  const info = await invoke<{ platform: string; hostname: string }>('get_device_info');
  const appVersion = await getVersion();

  const { error } = await supabase
    .from('user_devices')
    .upsert(
      {
        user_id: userId,
        device_id: machineId,
        device_name: info.hostname,
        platform: info.platform,
        app_version: appVersion,
        is_receiver: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' },
    );

  if (error) {
    // 치명적 오류 아님 — 동기화 안 써도 앱 다른 기능은 동작. 로깅만 남김.
    console.warn('[registerDesktopDevice] upsert failed:', error.message);
  }
}
