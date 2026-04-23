use std::path::Path;
use std::sync::Mutex;

mod sync_server;

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
}

// 서버는 앱 생애 주기 중 한 번만 시작. 이후 호출은 기존 port 반환.
static SYNC_SERVER: Mutex<Option<SyncServerInfo>> = Mutex::new(None);

// 폰이 파일을 업로드할 수 있도록 로컬 HTTP 서버 시작.
// 반환값으로 {port, local_ip, save_dir} 받아 user_devices 테이블에 upsert.
#[tauri::command]
async fn start_sync_server() -> Result<SyncServerInfo, String> {
    {
        let lock = SYNC_SERVER.lock().map_err(|e| e.to_string())?;
        if let Some(info) = &*lock {
            return Ok(info.clone());
        }
    }

    let save_dir = dirs::home_dir()
        .ok_or_else(|| "home directory not found".to_string())?
        .join("Downloads")
        .join("Velo-Sync");

    let port = sync_server::start(save_dir.clone()).await?;
    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());

    let info = SyncServerInfo {
        port,
        local_ip,
        save_dir: save_dir.to_string_lossy().to_string(),
    };

    *SYNC_SERVER.lock().map_err(|e| e.to_string())? = Some(info.clone());
    Ok(info)
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
            show_in_folder,
            write_binary_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
