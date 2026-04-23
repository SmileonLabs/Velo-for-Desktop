use std::path::Path;

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
            show_in_folder,
            write_binary_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
