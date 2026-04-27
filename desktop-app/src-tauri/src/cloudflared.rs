// Cloudflare Quick Tunnel 통합 — 외부 동기화용 공개 URL 자동 발급.
//
// 흐름:
//   1) start_sync_server가 LAN HTTP 서버를 띄운 직후 호출
//   2) cloudflared subprocess 실행 → stderr 로그에서 발급 URL 파싱
//   3) URL은 메모리에 캐시 → 프론트가 get_external_url로 조회/polling
//   4) 앱 종료(Tauri RunEvent::Exit) 시 child 프로세스 kill
//
// 디자인 메모:
//   - cloudflared 바이너리는 우선 PATH에서 탐색 → 실패해도 앱은 LAN-only로 정상 동작
//   - 추후 commit에서 Tauri sidecar(externalBin)로 번들링 예정 — 유저 별도 설치 불필요
//   - URL 발급은 spawn 후 ~3-5초 걸리므로 비동기. start 함수는 즉시 반환

use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

pub struct CloudflaredHandle {
    child: Mutex<Option<Child>>,
    external_url: Arc<Mutex<Option<String>>>,
}

impl CloudflaredHandle {
    pub fn external_url(&self) -> Option<String> {
        self.external_url
            .lock()
            .ok()
            .and_then(|g| g.clone())
    }
}

impl Drop for CloudflaredHandle {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

pub fn start(local_port: u16) -> Result<CloudflaredHandle, String> {
    let exe = which_cloudflared()?;
    let url_arg = format!("http://localhost:{}", local_port);

    // --no-autoupdate: cloudflared 자체 자동 업데이트 비활성화 — 추후 sidecar 번들링 시 필수.
    // --metrics 127.0.0.1:0: 메트릭 HTTP 서버 임의 포트(0=자동)로 — 충돌 방지.
    let mut child = Command::new(&exe)
        .args([
            "tunnel",
            "--url",
            &url_arg,
            "--no-autoupdate",
            "--metrics",
            "127.0.0.1:0",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("cloudflared spawn 실패: {}", e))?;

    let external_url = Arc::new(Mutex::new(None::<String>));

    // cloudflared는 INF 레벨 로그를 stderr로 출력. 발급 URL도 거기서 등장.
    // 라인 예: "INF |  https://xxx-yyy-zzz.trycloudflare.com  |"
    if let Some(stderr) = child.stderr.take() {
        let url_handle = external_url.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                if let Some(url) = extract_trycloudflare_url(&line) {
                    if let Ok(mut guard) = url_handle.lock() {
                        if guard.is_none() {
                            *guard = Some(url.clone());
                            eprintln!("[cloudflared] external URL: {}", url);
                        }
                    }
                }
            }
        });
    }

    // stdout도 반드시 drain — pipe buffer가 차면 child가 write에서 block.
    if let Some(stdout) = child.stdout.take() {
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for _ in reader.lines().map_while(Result::ok) {}
        });
    }

    Ok(CloudflaredHandle {
        child: Mutex::new(Some(child)),
        external_url,
    })
}

// 번들 sidecar → dev sidecar → PATH → 일반 설치 경로 순으로 탐색.
//
// Tauri가 externalBin으로 등록된 cloudflared를:
//   - production: main exe와 같은 디렉토리에 "cloudflared{ext}" 이름으로 복사
//   - dev: target/{profile}/ 에 "cloudflared-{TARGET_TRIPLE}{ext}" 이름으로 복사
fn which_cloudflared() -> Result<String, String> {
    let exe_name = if cfg!(target_os = "windows") {
        "cloudflared.exe"
    } else {
        "cloudflared"
    };
    let dev_exe_name = format!(
        "cloudflared-{}{}",
        env!("TARGET_TRIPLE"),
        if cfg!(target_os = "windows") { ".exe" } else { "" }
    );

    // 1) main 실행 파일 옆에 번들된 sidecar
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let prod = dir.join(exe_name);
            if prod.exists() {
                return Ok(prod.to_string_lossy().into_owned());
            }
            let dev = dir.join(&dev_exe_name);
            if dev.exists() {
                return Ok(dev.to_string_lossy().into_owned());
            }
        }
    }

    // 2) PATH (개발자가 brew/winget으로 직접 설치한 케이스)
    if Command::new("cloudflared").arg("--version").output().is_ok() {
        return Ok("cloudflared".to_string());
    }

    // 3) 일반적 설치 경로 (PATH 누락 케이스)
    let candidates: &[&str] = if cfg!(target_os = "macos") {
        &[
            "/opt/homebrew/bin/cloudflared",
            "/usr/local/bin/cloudflared",
        ]
    } else if cfg!(target_os = "windows") {
        &[
            "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
            "C:\\Program Files\\cloudflared\\cloudflared.exe",
        ]
    } else {
        &["/usr/local/bin/cloudflared", "/usr/bin/cloudflared"]
    };
    for c in candidates {
        if std::path::Path::new(c).exists() {
            return Ok(c.to_string());
        }
    }
    Err("cloudflared 바이너리를 찾을 수 없음 (LAN-only 모드로 동작)".to_string())
}

// 로그 라인에서 trycloudflare.com URL만 추출. 테이블 포맷("|  url  |") / 평문 모두 처리.
fn extract_trycloudflare_url(line: &str) -> Option<String> {
    let idx = line.find("https://")?;
    let tail = &line[idx..];
    let end = tail
        .find(|c: char| c.is_whitespace() || c == '|' || c == ',')
        .unwrap_or(tail.len());
    let url = &tail[..end];
    if url.contains(".trycloudflare.com") {
        Some(
            url.trim_end_matches(|c: char| !c.is_alphanumeric())
                .to_string(),
        )
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_table_format() {
        let line = "2024-01-01T00:00:00Z INF |  https://abc-def-ghi.trycloudflare.com  |";
        assert_eq!(
            extract_trycloudflare_url(line).as_deref(),
            Some("https://abc-def-ghi.trycloudflare.com")
        );
    }

    #[test]
    fn parses_plain_format() {
        let line = "Visit it at: https://foo-bar.trycloudflare.com";
        assert_eq!(
            extract_trycloudflare_url(line).as_deref(),
            Some("https://foo-bar.trycloudflare.com")
        );
    }

    #[test]
    fn ignores_non_trycloudflare_urls() {
        let line = "see https://developers.cloudflare.com for docs";
        assert_eq!(extract_trycloudflare_url(line), None);
    }
}
