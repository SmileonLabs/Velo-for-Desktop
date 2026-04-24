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
    extract::{DefaultBodyLimit, Query, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, net::SocketAddr, path::PathBuf, sync::Arc};
use tauri::{AppHandle, Emitter};

use crate::sync_store::{InventoryEntry, ReceivedRecord, SyncStore};

#[derive(Clone)]
struct AppState {
    save_dir: PathBuf,
    app: AppHandle,
    store: Arc<SyncStore>,
}

// 프론트로 전달할 수신 이벤트 — ReceivedRecord와 동일 스키마로 통일.
// 프론트는 DB 조회 결과와 이벤트 페이로드를 같은 타입으로 처리 가능.

pub async fn start(save_dir: PathBuf, app: AppHandle, store: Arc<SyncStore>) -> Result<u16, String> {
    tokio::fs::create_dir_all(&save_dir)
        .await
        .map_err(|e| format!("save_dir 생성 실패: {}", e))?;

    let state = AppState { save_dir, app, store };
    let app = Router::new()
        .route("/ping", get(ping_handler))
        .route("/upload", post(upload_handler))
        // 폰이 "이 파일 데스크탑에 있니?" 확인 — 폰 원본 삭제 전 안전장치.
        .route("/exists", get(exists_handler))
        // 폰이 델타 계산 — "이 기기(device_id)가 보낸 것 중 내가 이미 받은 것" 목록.
        .route("/inventory", get(inventory_handler))
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

    // 폰이 보낸 메타데이터 헤더 (옵션) — 없으면 null로 기록.
    let from_device_id = headers.get("x-velo-device-id")
        .and_then(|v| v.to_str().ok()).map(String::from);
    let from_mdns_name = headers.get("x-velo-mdns-name")
        .and_then(|v| v.to_str().ok()).map(String::from);
    let phone_asset_id = headers.get("x-velo-asset-id")
        .and_then(|v| v.to_str().ok()).map(String::from);
    let media_type = headers.get("x-velo-media-type")
        .and_then(|v| v.to_str().ok()).map(String::from);

    let received_at_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let record = ReceivedRecord {
        content_hash: computed_hash.clone(),
        file_name: safe_name.clone(),
        file_size: body.len() as i64,
        media_type,
        from_device_id,
        from_mdns_name,
        phone_asset_id,
        local_path: path.to_string_lossy().to_string(),
        received_at_ms,
    };
    if let Err(e) = state.store.upsert(&record) {
        eprintln!("[sync_server] store upsert failed: {}", e);
        // DB 기록 실패해도 파일은 디스크에 있으니 업로드 자체는 성공 처리.
    }

    // 프론트에 실시간 이벤트 — ReceivedRecord 전체를 그대로 전달.
    // DB 조회 결과와 동일 스키마라 프론트가 한 타입으로 처리 가능.
    let _ = state.app.emit("velo://file-received", &record);

    Ok(Json(serde_json::json!({
        "ok": true,
        "path": path.to_string_lossy(),
        "hash": computed_hash,
        "size": body.len(),
    })))
}


// 폰이 원본 삭제 직전 "이 해시가 데스크탑에 있나?" 확인.
// 200 OK + { exists: true/false }
async fn exists_handler(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let hash = params.get("hash")
        .ok_or((StatusCode::BAD_REQUEST, "missing hash".to_string()))?
        .to_lowercase();
    let exists = state.store.exists(&hash)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(serde_json::json!({ "exists": exists, "hash": hash })))
}

// 폰이 델타 계산 시 호출 — 특정 device_id에서 이미 받은 파일의 핵심 식별자만 반환.
// 폰은 로컬 PHAsset 목록과 비교해 "아직 안 보낸 것"만 업로드.
async fn inventory_handler(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let device_id = params.get("device_id")
        .ok_or((StatusCode::BAD_REQUEST, "missing device_id".to_string()))?;
    let entries: Vec<InventoryEntry> = state.store.inventory_for_device(device_id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(serde_json::json!({
        "deviceId": device_id,
        "count": entries.len(),
        "entries": entries,
    })))
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .filter(|c| *c != '/' && *c != '\\' && *c != '\0')
        .collect::<String>()
        .trim()
        .to_string()
}
