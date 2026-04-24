use std::path::{Path, PathBuf};
use std::sync::Mutex;

mod sync_server;
mod mdns_advertiser;
mod sync_store;
mod folder_scanner;

use sync_store::SyncStore;
use std::sync::Arc;

// 앱 설정 — 저장 폴더 등 유저 커스터마이즈 값. <app_data>/com.smileon.velo/settings.json
#[derive(serde::Serialize, serde::Deserialize, Default)]
struct AppSettings {
    #[serde(default)]
    save_dir: Option<String>,
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

    let info = SyncServerInfo {
        port,
        local_ip,
        save_dir: save_dir.to_string_lossy().to_string(),
        mdns_name,
    };

    *SYNC_SERVER.lock().map_err(|e| e.to_string())? = Some(info.clone());
    Ok(info)
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
            scan_folder_media
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
