// 폰 → 데스크탑 파일 수신 HTTP 서버.
//
// 엔드포인트:
//   GET  /ping   - 서비스 식별용. 폰이 데스크탑 발견 후 "이게 Velo 맞나" 확인.
//   POST /upload - 바이너리 업로드. 헤더 X-Velo-Filename / X-Velo-Content-Hash 요구.
//
// 저장 위치: ~/Downloads/Velo-Sync/<sanitized_filename>
// TODO: 인증 토큰 (phone ↔ desktop 간 공유된 session-scoped secret) 검증 추가
//       현재는 LAN 내부라 가정. 공용 Wi-Fi 방어는 v2.

use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use sha2::{Digest, Sha256};
use std::{net::SocketAddr, path::PathBuf};
use tauri::{AppHandle, Emitter};

#[derive(Clone)]
struct AppState {
    save_dir: PathBuf,
    app: AppHandle,
}

// 프론트로 전달할 수신 이벤트 payload.
#[derive(serde::Serialize, Clone)]
struct FileReceivedEvent {
    filename: String,
    size: u64,
    hash: String,
    path: String,
    received_at: String, // ISO-8601
}

pub async fn start(save_dir: PathBuf, app: AppHandle) -> Result<u16, String> {
    tokio::fs::create_dir_all(&save_dir)
        .await
        .map_err(|e| format!("save_dir 생성 실패: {}", e))?;

    let state = AppState { save_dir, app };
    let app = Router::new()
        .route("/ping", get(ping_handler))
        .route("/upload", post(upload_handler))
        // 10 GB 상한 — 4K ProRes 장시간 영상도 수용. 실질 상한은 디스크 공간.
        .layer(DefaultBodyLimit::max(10 * 1024 * 1024 * 1024))
        .with_state(state);

    // 포트 0 = OS가 가용 포트 자동 할당. 같은 LAN에 여러 Velo 데스크탑 구동 가능.
    let listener = tokio::net::TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], 0)))
        .await
        .map_err(|e| format!("TCP bind 실패: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .port();

    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            eprintln!("[sync_server] serve error: {}", e);
        }
    });

    Ok(port)
}

async fn ping_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "service": "velo-desktop",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

async fn upload_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let filename = headers
        .get("x-velo-filename")
        .and_then(|v| v.to_str().ok())
        .ok_or((
            StatusCode::BAD_REQUEST,
            "missing X-Velo-Filename header".to_string(),
        ))?;

    // 전송 중 손상 감지 — 폰이 계산한 해시와 데스크탑이 저장한 바이트의 해시 비교.
    let expected_hash = headers
        .get("x-velo-content-hash")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_lowercase());

    let mut hasher = Sha256::new();
    hasher.update(&body);
    let computed_hash = hex::encode(hasher.finalize());

    if let Some(expected) = &expected_hash {
        if expected != &computed_hash {
            return Err((
                StatusCode::BAD_REQUEST,
                format!(
                    "hash mismatch: phone={} desktop={}",
                    expected, computed_hash
                ),
            ));
        }
    }

    // 경로 traversal 방어 — "/" "\" "\0" 제거
    let safe_name = sanitize_filename(filename);
    if safe_name.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "invalid filename".to_string()));
    }
    let path = state.save_dir.join(&safe_name);

    tokio::fs::write(&path, &body)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("write failed: {}", e)))?;

    // 프론트에 실시간 이벤트 — 토스트 / 수신 리스트 갱신에 사용.
    let event = FileReceivedEvent {
        filename: safe_name.clone(),
        size: body.len() as u64,
        hash: computed_hash.clone(),
        path: path.to_string_lossy().to_string(),
        received_at: chrono_now_iso(),
    };
    let _ = state.app.emit("velo://file-received", event);

    Ok(Json(serde_json::json!({
        "ok": true,
        "path": path.to_string_lossy(),
        "hash": computed_hash,
        "size": body.len(),
    })))
}

// 외부 크레이트 없이 현재 시각 ISO-8601 포맷 — serde_json 경유 System time → UTC.
fn chrono_now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let days = secs / 86400;
    let t = secs % 86400;
    let (h, m, s) = (t / 3600, (t % 3600) / 60, t % 60);
    // 1970-01-01 기준 일수 → Y/M/D 역산
    let (y, mo, d) = days_to_ymd(days as i64);
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", y, mo, d, h, m, s)
}

fn days_to_ymd(days_since_epoch: i64) -> (i64, u32, u32) {
    // Howard Hinnant 달력 알고리즘 (정확 + 라이브러리 의존 없음)
    let z = days_since_epoch + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .filter(|c| *c != '/' && *c != '\\' && *c != '\0')
        .collect::<String>()
        .trim()
        .to_string()
}
