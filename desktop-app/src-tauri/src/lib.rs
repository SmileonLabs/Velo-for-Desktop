use std::path::{Path, PathBuf};
use std::sync::Mutex;

mod sync_server;
mod mdns_advertiser;
mod mdns_discoverer;
mod sync_store;
mod folder_scanner;
mod compression_store;
mod wifi_direct;
mod cloudflared;

use sync_store::SyncStore;
use std::sync::Arc;

// 앱 설정 — 저장 폴더 등 유저 커스터마이즈 값. <app_data>/com.smileon.velo/settings.json
#[derive(serde::Serialize, serde::Deserialize, Default)]
struct AppSettings {
    #[serde(default)]
    save_dir: Option<String>,
    // 폰↔데스크탑 인증 토큰 — 첫 실행 시 32바이트 OS 난수로 생성, 이후 영속.
    // 설정 파일 손상/리셋 시 새 토큰 발급 → 폰은 재페어링 필요.
    #[serde(default)]
    pairing_token: Option<String>,
}

fn settings_path() -> Result<PathBuf, String> {
    dirs::data_dir()
        .map(|p| p.join("com.smileon.velo").join("settings.json"))
        .ok_or_else(|| "data dir not found".to_string())
}

fn load_settings() -> AppSettings {
    // 실패 케이스(파일 없음/파싱 오류)는 기본값. 설정 손상돼도 앱은 떠야 함.
    settings_path()
        .ok()
        .and_then(|p| std::fs::read_to_string(&p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_settings(s: &AppSettings) -> Result<(), String> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("settings dir: {}", e))?;
    }
    let json = serde_json::to_string_pretty(s).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("settings write: {}", e))?;
    Ok(())
}

// 페어링 토큰 보장 — 없으면 32바이트 OS 난수 생성 후 settings.json에 영속.
// 한 번 생성된 토큰은 기기 재설정 전까지 동일 → 폰은 1회 페어링 후 영구 사용.
fn ensure_pairing_token() -> Result<String, String> {
    let mut s = load_settings();
    if let Some(token) = &s.pairing_token {
        if !token.is_empty() {
            return Ok(token.clone());
        }
    }
    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes).map_err(|e| format!("os rng: {}", e))?;
    let token = hex::encode(bytes);
    s.pairing_token = Some(token.clone());
    save_settings(&s)?;
    Ok(token)
}

// 현재 cloudflared가 발급한 외부 URL — sync_server의 /pair 핸들러에서 호출.
pub(crate) fn current_external_url() -> Option<String> {
    CLOUDFLARED
        .lock()
        .ok()
        .and_then(|g| g.as_ref().and_then(|h| h.external_url()))
}

// 현재 페어링 토큰 — sync_server의 /pair 핸들러에서 호출.
// 실패 시 빈 문자열 (실제로는 ensure_pairing_token이 start_sync_server에서 1회 보장됨).
pub(crate) fn current_pairing_token() -> String {
    load_settings().pairing_token.unwrap_or_default()
}

#[tauri::command]
fn move_to_trash(path: String) -> Result<(), String> {
    trash::delete(Path::new(&path)).map_err(|e| e.to_string())
}

#[tauri::command]
fn show_in_folder(path: String) {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let _ = Command::new("explorer")
            .arg(format!("/select,{}", path))
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let _ = Command::new("open").args(["-R", &path]).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let _ = Command::new("xdg-open")
            .arg(std::path::Path::new(&path).parent().unwrap())
            .spawn();
    }
}

#[tauri::command]
fn get_machine_id() -> Result<String, String> {
    machine_uid::get().map_err(|e| e.to_string())
}

#[tauri::command]
fn write_binary_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    std::fs::write(path, bytes).map_err(|e| e.to_string())
}

// 폴더 압축 모드에서 출력 경로의 부모 디렉토리 보장 — FFmpeg는 상위 폴더 자동 생성 안 함.
#[tauri::command]
fn ensure_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| format!("create dir: {}", e))
}

// 다른 Velo 기기 발견 시작 — 첫 호출 시에만 실제 browser 시작, 이후 무동작.
// 자기 자신 device_id는 결과에서 자동 제외 (mdns_advertiser와 같은 광고를 받아도 무시).
#[tauri::command]
fn start_device_discovery() -> Result<(), String> {
    let mut lock = MDNS_BROWSER.lock().map_err(|e| e.to_string())?;
    if lock.is_some() {
        return Ok(());
    }
    let own_device_id = machine_uid::get().unwrap_or_else(|_| "unknown".to_string());
    let handle = mdns_discoverer::MdnsBrowserHandle::start(own_device_id)?;
    *lock = Some(Arc::new(handle));
    Ok(())
}

// 현재까지 발견된 다른 Velo 기기 목록 (스냅샷).
// 프론트는 이 명령을 1~2초 polling 또는 별도 트리거로 호출.
#[tauri::command]
fn discover_devices() -> Result<Vec<mdns_discoverer::DiscoveredDevice>, String> {
    let lock = MDNS_BROWSER.lock().map_err(|e| e.to_string())?;
    Ok(lock.as_ref().map(|h| h.list()).unwrap_or_default())
}

// Wi-Fi Direct 자동 페어링 — 안드 P2P SSID에 Windows가 자동 접속.
// macOS·Linux는 stub이 미지원 응답 반환 (UI에서 비활성화).
#[tauri::command]
async fn wifi_direct_pair(
    ssid: String,
    passphrase: String,
) -> Result<wifi_direct::WifiDirectPairResult, String> {
    wifi_direct::pair(ssid, passphrase).await
}

// UI 토글 표시 결정용 — Windows true / 그 외 false.
#[tauri::command]
fn wifi_direct_supported() -> bool {
    wifi_direct::is_supported()
}

// 재실행 skip 룰 — 같은 입력을 또 압축하지 않도록 출력 경로 유무 체크.
#[tauri::command]
fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[derive(serde::Serialize)]
struct DeviceInfo {
    platform: String,
    hostname: String,
}

#[derive(serde::Serialize, Clone)]
struct SyncServerInfo {
    port: u16,
    local_ip: String,
    save_dir: String,
    mdns_name: Option<String>,
}

// 서버는 앱 생애 주기 중 한 번만 시작. 이후 호출은 기존 port 반환.
static SYNC_SERVER: Mutex<Option<SyncServerInfo>> = Mutex::new(None);
// mDNS daemon은 drop되면 광고 중단 → 앱 생애 주기 동안 살아있어야 함.
static MDNS_HANDLE: Mutex<Option<mdns_advertiser::MdnsHandle>> = Mutex::new(None);
// SQLite store — 수신 파일 메타데이터 DB. Arc로 sync_server와 공유.
static SYNC_STORE: Mutex<Option<Arc<SyncStore>>> = Mutex::new(None);
// 압축 세션 기록용 별도 store. 같은 DB 파일 공유, 다른 테이블.
static COMPRESSION_STORE: Mutex<Option<Arc<compression_store::CompressionStore>>> = Mutex::new(None);
// mDNS browser — 다른 Velo 기기 (폰·다른 데스크탑) 발견. 백그라운드 thread가 cache 갱신.
static MDNS_BROWSER: Mutex<Option<Arc<mdns_discoverer::MdnsBrowserHandle>>> = Mutex::new(None);
// Cloudflare Quick Tunnel — 외부 동기화용 공개 URL. 발급은 비동기(spawn 후 수 초).
// 앱 종료(RunEvent::Exit) 시 child 프로세스 정리.
static CLOUDFLARED: Mutex<Option<Arc<cloudflared::CloudflaredHandle>>> = Mutex::new(None);

fn ensure_store() -> Result<Arc<SyncStore>, String> {
    let mut lock = SYNC_STORE.lock().map_err(|e| e.to_string())?;
    if let Some(store) = &*lock {
        return Ok(store.clone());
    }
    let db_path = dirs::data_dir()
        .ok_or_else(|| "data dir not found".to_string())?
        .join("com.smileon.velo")
        .join("velo-sync.db");
    let store = Arc::new(SyncStore::open(db_path)?);
    *lock = Some(store.clone());
    Ok(store)
}

fn ensure_compression_store() -> Result<Arc<compression_store::CompressionStore>, String> {
    let mut lock = COMPRESSION_STORE.lock().map_err(|e| e.to_string())?;
    if let Some(store) = &*lock {
        return Ok(store.clone());
    }
    let db_path = dirs::data_dir()
        .ok_or_else(|| "data dir not found".to_string())?
        .join("com.smileon.velo")
        .join("velo-compression.db");
    let store = Arc::new(compression_store::CompressionStore::open(db_path)?);
    *lock = Some(store.clone());
    Ok(store)
}

// 받은 파일 목록 (최근 200건). 프론트의 ReceivedFilesModal에서 호출.
#[tauri::command]
fn list_received_files(limit: Option<i64>) -> Result<Vec<sync_store::ReceivedRecord>, String> {
    let store = ensure_store()?;
    store.list_recent(limit.unwrap_or(200))
}

// 폰이 삭제 안전장치용으로 호출. content_hash 유무만 반환.
#[tauri::command]
fn has_received_file(content_hash: String) -> Result<bool, String> {
    let store = ensure_store()?;
    store.exists(&content_hash)
}

// 압축 세션 시작 — "압축 시작" 버튼 눌렸을 때. session_id는 프론트에서 UUID 생성해 전달.
#[tauri::command]
fn compress_session_start(
    session_id: String,
    session_type: String,
    root_path: Option<String>,
    total_count: i64,
) -> Result<(), String> {
    let store = ensure_compression_store()?;
    store.start_session(&session_id, &session_type, root_path.as_deref(), total_count)
}

// 파일 하나 처리 완료 시 호출 — 성공/실패/skip 모두 같은 API로.
#[tauri::command]
fn compress_record_insert(record: compression_store::CompressionRecord) -> Result<(), String> {
    let store = ensure_compression_store()?;
    store.insert_record(&record)
}

// 세션 종료 — 집계 값 일괄 업데이트 + ended_at_ms 기록.
#[tauri::command]
fn compress_session_end(
    session_id: String,
    done_count: i64,
    failed_count: i64,
    skipped_count: i64,
    total_original: i64,
    total_compressed: i64,
) -> Result<(), String> {
    let store = ensure_compression_store()?;
    store.end_session(&session_id, done_count, failed_count, skipped_count, total_original, total_compressed)
}

// 재실행 skip 룰용 — 특정 input_path가 이미 성공적으로 압축된 적 있는지.
// 있으면 해당 record 반환 (output_path 등 포함). P5에서 사용.
#[tauri::command]
fn compress_find_previous(input_path: String) -> Result<Option<compression_store::CompressionRecord>, String> {
    let store = ensure_compression_store()?;
    store.find_successful_record(&input_path)
}

// 압축 세션 기록 조회 — 최근 N개.
#[tauri::command]
fn compress_recent_sessions(limit: Option<i64>) -> Result<Vec<compression_store::CompressionSession>, String> {
    let store = ensure_compression_store()?;
    store.recent_sessions(limit.unwrap_or(50))
}

// 폴더 압축 모드 진입 시 호출 — 선택한 폴더를 재귀 스캔해 안의 비디오/이미지 전부 나열.
// 출력 폴더(_velo_compressed)는 자동 제외 → 재처리 무한 루프 방지.
#[tauri::command]
fn scan_folder_media(root_path: String) -> Result<folder_scanner::ScanResult, String> {
    folder_scanner::scan(Path::new(&root_path))
}

// 기기별 수신 통계 — ReceivedFilesModal 상단 통계 스트립에 표시.
#[tauri::command]
fn device_stats() -> Result<Vec<sync_store::DeviceStat>, String> {
    let store = ensure_store()?;
    store.device_stats()
}

// "정리" 플로우 — 데스크탑에서 받은 파일 삭제 (원본 + DB row)
#[tauri::command]
fn delete_received_file(content_hash: String) -> Result<(), String> {
    let store = ensure_store()?;
    if let Some(record) = store.list_recent(10_000)?.into_iter().find(|r| r.content_hash == content_hash) {
        let _ = std::fs::remove_file(&record.local_path);
    }
    store.delete_by_hash(&content_hash)
}

// 폰이 파일을 업로드할 수 있도록 로컬 HTTP 서버 시작.
// 반환값으로 {port, local_ip, save_dir} 받아 user_devices 테이블에 upsert.
#[tauri::command]
async fn start_sync_server(app: tauri::AppHandle) -> Result<SyncServerInfo, String> {
    {
        let lock = SYNC_SERVER.lock().map_err(|e| e.to_string())?;
        if let Some(info) = &*lock {
            return Ok(info.clone());
        }
    }

    // 저장 경로: 유저가 설정한 경로 우선 > 기본(~/Downloads/Velo-Sync).
    let default_dir = dirs::home_dir()
        .ok_or_else(|| "home directory not found".to_string())?
        .join("Downloads")
        .join("Velo-Sync");
    let save_dir = match load_settings().save_dir {
        Some(p) if !p.is_empty() => PathBuf::from(p),
        _ => default_dir,
    };

    // 페어링 토큰 보장 — 없으면 첫 실행 시 1회 생성. /pair 핸들러보다 먼저 준비.
    let _ = ensure_pairing_token()?;

    let store = ensure_store()?;
    let port = sync_server::start(save_dir.clone(), app.clone(), store).await?;
    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());

    // mDNS 광고 시작 — 실패해도 앱 다른 기능엔 영향 없음 (Supabase 폴링으로 대체 가능).
    let device_id = machine_uid::get().unwrap_or_else(|_| "unknown".to_string());
    let device_name = get_device_name();
    let mdns_name = match mdns_advertiser::start(port, &local_ip, &device_id, &device_name) {
        Ok(handle) => {
            let name = handle.full_name().to_string();
            *MDNS_HANDLE.lock().map_err(|e| e.to_string())? = Some(handle);
            Some(name)
        }
        Err(e) => {
            eprintln!("[mdns] register failed: {}", e);
            None
        }
    };

    // Cloudflare Quick Tunnel 시작 — 실패해도 LAN-only 모드로 정상 동작.
    // URL 발급은 비동기(stderr 파싱)이므로 여기서는 spawn만 하고 즉시 반환.
    match cloudflared::start(port) {
        Ok(handle) => {
            *CLOUDFLARED.lock().map_err(|e| e.to_string())? = Some(Arc::new(handle));
        }
        Err(e) => {
            eprintln!("[cloudflared] disabled — {}", e);
        }
    }

    let info = SyncServerInfo {
        port,
        local_ip,
        save_dir: save_dir.to_string_lossy().to_string(),
        mdns_name,
    };

    *SYNC_SERVER.lock().map_err(|e| e.to_string())? = Some(info.clone());
    Ok(info)
}

// 외부 URL 조회 — cloudflared가 stderr에서 URL을 캡처하면 None → Some으로 변경됨.
// 프론트는 sync_server 시작 후 1초 간격으로 polling, 최대 ~15초까지 기다리면 충분.
// 시스템에 cloudflared 미설치 시 영구 None — 자연스럽게 LAN-only UX.
#[tauri::command]
fn get_external_url() -> Option<String> {
    current_external_url()
}

// 폰 페어링 페이로드 — 프론트가 QR/공유 링크로 폰에 전달하기 위해 호출.
// 폰은 이 페이로드만 있으면 LAN/외부 양쪽 동기화 가능.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PairingPayload {
    device_id: String,
    device_name: String,
    lan_ip: String,
    port: u16,
    external_url: Option<String>,
    token: String,
    version: String,
}

#[tauri::command]
fn get_pairing_payload() -> Result<PairingPayload, String> {
    let info = SYNC_SERVER
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or_else(|| "sync server not started yet".to_string())?;
    let token = ensure_pairing_token()?;
    Ok(PairingPayload {
        device_id: machine_uid::get().unwrap_or_else(|_| "unknown".to_string()),
        device_name: get_device_name(),
        lan_ip: info.local_ip,
        port: info.port,
        external_url: current_external_url(),
        token,
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

// 저장 폴더 변경 — settings.json에 영속화. 현재 세션의 서버는 기존 경로 유지,
// 다음 앱 실행부터 새 경로 적용. 서버 hot-restart는 포트 변동 이슈가 있어 v2로 미룸.
#[tauri::command]
fn set_save_dir(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    std::fs::create_dir_all(&p).map_err(|e| format!("create dir: {}", e))?;
    let mut s = load_settings();
    s.save_dir = Some(path);
    save_settings(&s)
}

// 현재 설정된 save_dir 조회 — 서버 재시작 전/후 경로 비교용.
// effective: 현재 서버가 쓰는 경로 / configured: settings.json에 저장된 경로.
#[tauri::command]
fn get_save_dir_info() -> Result<serde_json::Value, String> {
    let configured = load_settings().save_dir;
    let effective = SYNC_SERVER
        .lock()
        .map_err(|e| e.to_string())?
        .as_ref()
        .map(|info| info.save_dir.clone());
    Ok(serde_json::json!({
        "configured": configured,
        "effective": effective,
    }))
}

// 기기 플랫폼과 사용자 표시용 이름을 반환. Supabase user_devices.device_name 용도.
// macOS는 System Settings의 "ComputerName" (예: "도도의 MacBook Pro")을 우선 사용.
#[tauri::command]
fn get_device_info() -> DeviceInfo {
    let platform = match std::env::consts::OS {
        "macos" => "macos",
        "windows" => "windows",
        "linux" => "linux",
        other => other,
    }
    .to_string();

    let hostname = get_device_name();
    DeviceInfo { platform, hostname }
}

fn get_device_name() -> String {
    #[cfg(target_os = "macos")]
    {
        if let Ok(out) = std::process::Command::new("scutil")
            .args(["--get", "ComputerName"])
            .output()
        {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !s.is_empty() {
                return s;
            }
        }
        if let Ok(out) = std::process::Command::new("hostname").output() {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !s.is_empty() {
                return s;
            }
        }
        return "Mac".to_string();
    }
    #[cfg(target_os = "windows")]
    {
        return std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Windows PC".to_string());
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        if let Ok(out) = std::process::Command::new("hostname").output() {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !s.is_empty() {
                return s;
            }
        }
        return std::env::var("HOSTNAME").unwrap_or_else(|_| "Linux PC".to_string());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        // OAuth 콜백용 custom URL scheme (velo://) 수신 — 브라우저에서 로그인 완료 시
        // Supabase가 velo://auth-callback#access_token=... 형식으로 리다이렉트.
        // 프론트에서 @tauri-apps/plugin-deep-link의 onOpenUrl 리스너로 이벤트 받아 세션 주입.
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            move_to_trash,
            get_machine_id,
            get_device_info,
            start_sync_server,
            list_received_files,
            has_received_file,
            delete_received_file,
            device_stats,
            set_save_dir,
            get_save_dir_info,
            show_in_folder,
            write_binary_file,
            scan_folder_media,
            ensure_dir,
            wifi_direct_pair,
            wifi_direct_supported,
            start_device_discovery,
            discover_devices,
            get_external_url,
            get_pairing_payload,
            file_exists,
            compress_session_start,
            compress_record_insert,
            compress_session_end,
            compress_find_previous,
            compress_recent_sessions
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            // 앱 종료 시 cloudflared child 프로세스 정리 — 정적 변수는 자동 drop되지 않음.
            if let tauri::RunEvent::Exit = event {
                if let Ok(mut g) = CLOUDFLARED.lock() {
                    *g = None;
                }
            }
        });
}
