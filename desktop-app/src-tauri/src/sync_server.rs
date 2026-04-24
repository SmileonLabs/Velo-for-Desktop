// 폰 → 데스크탑 파일 수신 HTTP 서버.
//
// 엔드포인트:
//   GET  /ping            - 서비스 식별용. 폰이 데스크탑 발견 후 "이게 Velo 맞나" 확인.
//   POST /upload          - 바이너리 업로드. 헤더 X-Velo-Filename / X-Velo-Content-Hash 요구.
//                           Content-Range 헤더 있으면 재개 업로드 청크로 처리.
//   GET  /upload/status   - 재개 업로드용: 서버가 현재 받은 바이트 수 조회.
//   GET  /exists          - 폰이 원본 삭제 직전 데스크탑에 파일 있는지 확인.
//   GET  /inventory       - 폰 델타 계산용: 특정 기기에서 이미 받은 파일 목록.
//
// 저장 위치: ~/Downloads/Velo-Sync/<sanitized_filename>
// 재개 업로드 임시: ~/Downloads/Velo-Sync/.velo-tmp/<hash>.part
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
use std::{collections::HashMap, net::SocketAddr, path::{Path, PathBuf}, sync::Arc};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

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
        // 재개 업로드: 폰이 "어디까지 받았어?" 조회 → 끊긴 지점부터 이어 전송.
        .route("/upload/status", get(upload_status_handler))
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
    // Content-Range 헤더 있으면 재개 업로드 경로 — 대용량 영상이 중간에 끊겨도 이어서 받을 수 있음.
    if let Some(range_str) = headers.get("content-range").and_then(|v| v.to_str().ok()) {
        let range = parse_content_range(range_str)
            .map_err(|e| (StatusCode::BAD_REQUEST, e))?;
        return upload_chunk(state, headers, body, range).await;
    }

    // Content-Range 없으면 기존 단일 요청 업로드 — 작은 사진/영상용.
    upload_full(state, headers, body).await
}

async fn upload_full(
    state: AppState,
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

    let safe_name = sanitize_filename(filename);
    if safe_name.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "invalid filename".to_string()));
    }
    let path = state.save_dir.join(&safe_name);

    tokio::fs::write(&path, &body)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("write failed: {}", e)))?;

    let size = body.len() as i64;
    finalize_received(&state, &headers, &computed_hash, &safe_name, &path, size).await;

    Ok(Json(serde_json::json!({
        "ok": true,
        "complete": true,
        "path": path.to_string_lossy(),
        "hash": computed_hash,
        "size": size,
    })))
}

// 재개 업로드 청크 처리. 폰이 Content-Range: bytes start-end/total 로 보낸 부분을
// <save_dir>/.velo-tmp/<hash>.part 파일에 append. 마지막 청크에서 full-file hash 검증 후
// 최종 경로로 atomic rename → store.upsert → 이벤트 발행.
async fn upload_chunk(
    state: AppState,
    headers: HeaderMap,
    body: Bytes,
    range: ContentRange,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let expected_hash = headers
        .get("x-velo-content-hash")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_lowercase())
        .ok_or((
            StatusCode::BAD_REQUEST,
            "X-Velo-Content-Hash required for resumable upload".to_string(),
        ))?;

    // tmp 디렉토리는 save_dir 하위에 둬서 rename이 같은 파일시스템 내 atomic 작업이 되게 함.
    let tmp_dir = state.save_dir.join(".velo-tmp");
    tokio::fs::create_dir_all(&tmp_dir)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("tmp dir: {}", e)))?;
    let tmp_path = tmp_dir.join(format!("{}.part", expected_hash));

    let current_size = match tokio::fs::metadata(&tmp_path).await {
        Ok(m) => m.len(),
        Err(_) => 0,
    };

    // 폰이 보낸 start 오프셋이 서버 실제 상태와 어긋나면 거부 — 폰이 /upload/status로 재동기화 후 재시도해야 함.
    if range.start != current_size {
        return Err((
            StatusCode::CONFLICT,
            format!(
                "range mismatch: server has {} bytes, phone sent start={}",
                current_size, range.start
            ),
        ));
    }

    // append 모드 — seek 불필요. OS의 O_APPEND가 동시성 안전 write 보장.
    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&tmp_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("tmp open: {}", e)))?;
    file.write_all(&body)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("tmp write: {}", e)))?;
    // fsync 안 함 — 청크마다 fsync하면 느려짐. 크래시 시 부분 파일은 /upload/status 조회 후 재개 가능.

    let new_size = current_size + body.len() as u64;

    // 아직 완료 안 됨 — 다음 청크 대기.
    if new_size < range.total {
        return Ok(Json(serde_json::json!({
            "ok": true,
            "complete": false,
            "receivedBytes": new_size,
            "totalBytes": range.total,
        })));
    }

    // 마지막 청크 도착 — full-file SHA-256 검증.
    let computed = hash_file_streaming(&tmp_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("hash verify: {}", e)))?;
    if computed != expected_hash {
        // 해시 불일치 → 파일 오염. tmp 정리하고 폰이 처음부터 다시 보내게 유도.
        let _ = tokio::fs::remove_file(&tmp_path).await;
        return Err((
            StatusCode::BAD_REQUEST,
            format!("full-file hash mismatch: expected={} got={}", expected_hash, computed),
        ));
    }

    let filename = headers
        .get("x-velo-filename")
        .and_then(|v| v.to_str().ok())
        .ok_or((
            StatusCode::BAD_REQUEST,
            "missing X-Velo-Filename header".to_string(),
        ))?;
    let safe_name = sanitize_filename(filename);
    if safe_name.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "invalid filename".to_string()));
    }
    let final_path = state.save_dir.join(&safe_name);

    tokio::fs::rename(&tmp_path, &final_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("rename: {}", e)))?;

    finalize_received(&state, &headers, &computed, &safe_name, &final_path, new_size as i64).await;

    Ok(Json(serde_json::json!({
        "ok": true,
        "complete": true,
        "path": final_path.to_string_lossy(),
        "hash": computed,
        "size": new_size,
    })))
}

// 폰이 재연결 후 "내가 어디까지 보냈지?" 조회. 이미 DB에 있으면 complete=true.
// tmp 파일 있으면 현재 누적 바이트 수 반환, 없으면 0.
async fn upload_status_handler(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let hash = params
        .get("hash")
        .ok_or((StatusCode::BAD_REQUEST, "missing hash".to_string()))?
        .to_lowercase();

    // 이미 최종 저장됐으면 폰은 업로드 건너뛰어도 됨.
    if state.store.exists(&hash).unwrap_or(false) {
        return Ok(Json(serde_json::json!({
            "hash": hash,
            "complete": true,
            "receivedBytes": 0,
        })));
    }

    let tmp_path = state.save_dir.join(".velo-tmp").join(format!("{}.part", hash));
    let received = match tokio::fs::metadata(&tmp_path).await {
        Ok(m) => m.len(),
        Err(_) => 0,
    };

    Ok(Json(serde_json::json!({
        "hash": hash,
        "complete": false,
        "receivedBytes": received,
    })))
}

// 업로드 완료 공통 후처리 — DB upsert + 프론트 이벤트 발행.
// full/chunk 양쪽에서 호출.
async fn finalize_received(
    state: &AppState,
    headers: &HeaderMap,
    content_hash: &str,
    safe_name: &str,
    path: &Path,
    size: i64,
) {
    // HTTP 헤더는 ASCII만 안전 — 폰(iOS)은 한글 기기명/asset-id 등을 percent-encoding해 보냄.
    // DB·UI에서 원본 그대로 보이도록 여기서 decode.
    let from_device_id = headers
        .get("x-velo-device-id")
        .and_then(|v| v.to_str().ok())
        .map(percent_decode);
    let from_mdns_name = headers
        .get("x-velo-mdns-name")
        .and_then(|v| v.to_str().ok())
        .map(percent_decode);
    let phone_asset_id = headers
        .get("x-velo-asset-id")
        .and_then(|v| v.to_str().ok())
        .map(percent_decode);
    let media_type = headers
        .get("x-velo-media-type")
        .and_then(|v| v.to_str().ok())
        .map(percent_decode);

    let received_at_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let record = ReceivedRecord {
        content_hash: content_hash.to_string(),
        file_name: safe_name.to_string(),
        file_size: size,
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

    let _ = state.app.emit("velo://file-received", &record);
}

struct ContentRange {
    start: u64,
    #[allow(dead_code)] // 프로토콜 필드 — parse 단계 검증에서만 사용.
    end: u64,
    total: u64,
}

// "bytes 0-1048575/5242880" 형식 파싱. end는 inclusive.
fn parse_content_range(s: &str) -> Result<ContentRange, String> {
    let s = s.trim();
    let body = s
        .strip_prefix("bytes ")
        .ok_or_else(|| format!("invalid Content-Range: {}", s))?;
    let (range_part, total_part) = body
        .split_once('/')
        .ok_or_else(|| format!("invalid Content-Range: {}", s))?;
    let (start_str, end_str) = range_part
        .split_once('-')
        .ok_or_else(|| format!("invalid Content-Range: {}", s))?;
    let start: u64 = start_str.parse().map_err(|_| format!("bad start in {}", s))?;
    let end: u64 = end_str.parse().map_err(|_| format!("bad end in {}", s))?;
    let total: u64 = total_part.parse().map_err(|_| format!("bad total in {}", s))?;

    if end < start || end >= total {
        return Err(format!("invalid range: start={} end={} total={}", start, end, total));
    }
    Ok(ContentRange { start, end, total })
}

// 대용량 파일의 SHA-256을 스트리밍으로 계산 — 메모리에 전부 올리지 않음.
async fn hash_file_streaming(path: &Path) -> Result<String, String> {
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|e| format!("open {}: {}", path.display(), e))?;
    let mut hasher = Sha256::new();
    // 64KB 청크 — 메모리 부담 없고 디스크 I/O도 효율적.
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let n = file.read(&mut buf).await.map_err(|e| format!("read: {}", e))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
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

// HTTP 헤더에 담긴 percent-encoded UTF-8을 원본 문자열로 복원.
// 폰이 보낸 "도도의 iPhone" → "%EB%8F%84%EB%8F%84%EC%9D%98 iPhone" → 다시 "도도의 iPhone".
// 크레이트 의존 없이 처리 — 용도가 이 파일 내부로 한정돼 있어 20줄이 간결.
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(hi), Some(lo)) = (hex_nibble(bytes[i + 1]), hex_nibble(bytes[i + 2])) {
                out.push((hi << 4) | lo);
                i += 3;
                continue;
            }
        }
        // '+'는 form 인코딩 전용이라 여기선 변환하지 않음 — RFC 3986 percent-encoding만 지원.
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn hex_nibble(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .filter(|c| *c != '/' && *c != '\\' && *c != '\0')
        .collect::<String>()
        .trim()
        .to_string()
}
