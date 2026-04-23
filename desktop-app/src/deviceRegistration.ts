import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { supabase } from './supabase';

interface SyncServerInfo {
  port: number;
  local_ip: string;
  save_dir: string;
  mdns_name: string | null;
}

// 현재 데스크탑을 Supabase user_devices 테이블에 등록/갱신 + 파일 수신 HTTP 서버 시작.
//
// 동작:
//   1) Rust start_sync_server 호출 → 랜덤 포트로 axum 서버 띄움 + local IP/save_dir 반환
//   2) machine_id + 기기 이름 + platform + app version 수집
//   3) user_devices 테이블에 upsert (is_receiver=true + port + local_ip 포함)
//
// 실패 시 앱 나머지 기능엔 영향 없음 — 로깅만 남기고 조용히 넘어감.
export async function registerDesktopDevice(userId: string): Promise<void> {
  try {
    const server: SyncServerInfo = await invoke('start_sync_server');
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
          local_ip: server.local_ip,
          port: server.port,
          mdns_name: server.mdns_name,
          is_receiver: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,device_id' },
      );

    if (error) {
      console.warn('[registerDesktopDevice] upsert failed:', error.message);
    }
  } catch (err) {
    console.warn('[registerDesktopDevice] failed:', err);
  }
}
