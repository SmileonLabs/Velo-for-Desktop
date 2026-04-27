import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { supabase } from './supabase';

interface SyncServerInfo {
  port: number;
  local_ip: string;
  save_dir: string;
  mdns_name: string | null;
}

// heartbeat 주기 — 60초. 너무 짧으면 Supabase 쿼터 소모, 너무 길면 폰 UI가 "오프라인"으로 오인.
const HEARTBEAT_INTERVAL_MS = 60_000;

// 현재 기기의 device_id 캐시 — heartbeat 시 재호출 비용 절감.
let cachedDeviceId: string | null = null;

async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  cachedDeviceId = await invoke<string>('get_machine_id');
  return cachedDeviceId;
}

// last_seen_at만 갱신. 전체 upsert 대비 가벼움 (폰이 "실시간 접속" 판정에만 사용).
export async function touchDeviceHeartbeat(userId: string): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    const { error } = await supabase
      .from('user_devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('device_id', deviceId);
    if (error) {
      console.warn('[heartbeat] update failed:', error.message);
    }
  } catch (err) {
    console.warn('[heartbeat] failed:', err);
  }
}

// 로그인 세션 시작 시 호출 — 타이머 setInterval 반환. 세션 종료 시 clearInterval 필요.
export function startHeartbeat(userId: string): ReturnType<typeof setInterval> {
  return setInterval(() => {
    void touchDeviceHeartbeat(userId);
  }, HEARTBEAT_INTERVAL_MS);
}

// 현재 데스크탑을 Supabase user_devices 테이블에 등록/갱신 + 파일 수신 HTTP 서버 시작.
//
// 동작:
//   1) Rust start_sync_server / get_machine_id / get_device_info / getVersion 4개 호출을 병렬화
//      (이전엔 순차 await — 4 × IPC 왕복 = 200~800ms 누적. 병렬로 가장 느린 1번만큼만 걸림)
//   2) user_devices 테이블에 upsert (is_receiver=true + port + local_ip 포함)
//
// 실패 시 앱 나머지 기능엔 영향 없음 — 로깅만 남기고 조용히 넘어감.
export async function registerDesktopDevice(userId: string): Promise<void> {
  try {
    const [server, machineId, info, appVersion] = await Promise.all([
      invoke<SyncServerInfo>('start_sync_server'),
      getDeviceId(), // 캐시된 값 재사용 — heartbeat과 중복 호출 제거
      invoke<{ platform: string; hostname: string }>('get_device_info'),
      getVersion(),
    ]);

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
