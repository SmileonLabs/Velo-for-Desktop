// 압축 세션·파일별 결과 기록 SQLite DB — iOS/Android의 BatchSession + CompressionRecord 대응.
// sync_store.rs와 동일 패턴 (rusqlite bundled). 같은 velo-sync.db 파일 재사용.
//
// 목적:
//   1) 세션 단위 집계 — 몇 개 처리했는지, 얼마나 절감했는지, 얼마나 걸렸는지
//   2) 파일별 개별 기록 — 실패 원인/skip 사유 추적
//   3) 재실행 skip 룰 근거 (P5) — 같은 input_path가 이미 성공한 적 있나

use rusqlite::{Connection, OptionalExtension, params};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CompressionSession {
    pub session_id: String,
    pub session_type: String,        // "file" | "folder"
    pub root_path: Option<String>,   // folder 모드일 때만 의미 있음
    pub started_at_ms: i64,
    pub ended_at_ms: Option<i64>,
    pub total_count: i64,
    pub done_count: i64,
    pub failed_count: i64,
    pub skipped_count: i64,
    pub total_original_bytes: i64,
    pub total_compressed_bytes: i64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CompressionRecord {
    pub id: String,
    pub session_id: String,
    pub file_name: String,
    pub input_path: String,
    pub output_path: Option<String>,
    pub media_type: String,          // "video" | "image"
    pub format: String,              // "mp4" | "webp" | etc.
    pub original_size: i64,
    pub compressed_size: i64,
    pub skipped: bool,
    pub skip_reason: Option<String>,
    pub error_message: Option<String>,
    pub completed_at_ms: i64,
}

pub struct CompressionStore {
    conn: Mutex<Connection>,
}

impl CompressionStore {
    pub fn open(db_path: PathBuf) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("db dir: {}", e))?;
        }
        let conn = Connection::open(&db_path).map_err(|e| format!("open db: {}", e))?;
        let store = CompressionStore { conn: Mutex::new(conn) };
        store.migrate()?;
        Ok(store)
    }

    fn migrate(&self) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        c.execute_batch(r#"
            create table if not exists compression_sessions (
              session_id text primary key,
              session_type text not null,
              root_path text,
              started_at_ms integer not null,
              ended_at_ms integer,
              total_count integer not null default 0,
              done_count integer not null default 0,
              failed_count integer not null default 0,
              skipped_count integer not null default 0,
              total_original_bytes integer not null default 0,
              total_compressed_bytes integer not null default 0
            );
            create index if not exists compression_sessions_started_idx
              on compression_sessions(started_at_ms desc);

            create table if not exists compression_records (
              id text primary key,
              session_id text not null,
              file_name text not null,
              input_path text not null,
              output_path text,
              media_type text not null,
              format text not null,
              original_size integer not null default 0,
              compressed_size integer not null default 0,
              skipped integer not null default 0,
              skip_reason text,
              error_message text,
              completed_at_ms integer not null
            );
            create index if not exists compression_records_session_idx
              on compression_records(session_id);
            create index if not exists compression_records_input_idx
              on compression_records(input_path);
        "#).map_err(|e| format!("migrate: {}", e))
    }

    pub fn start_session(
        &self,
        session_id: &str,
        session_type: &str,
        root_path: Option<&str>,
        total_count: i64,
    ) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        c.execute(
            r#"insert into compression_sessions
               (session_id, session_type, root_path, started_at_ms, total_count)
               values (?1, ?2, ?3, ?4, ?5)"#,
            params![session_id, session_type, root_path, now, total_count],
        ).map_err(|e| format!("start_session: {}", e))?;
        Ok(())
    }

    pub fn insert_record(&self, r: &CompressionRecord) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        c.execute(
            r#"insert or replace into compression_records
               (id, session_id, file_name, input_path, output_path, media_type, format,
                original_size, compressed_size, skipped, skip_reason, error_message, completed_at_ms)
               values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)"#,
            params![
                r.id, r.session_id, r.file_name, r.input_path, r.output_path,
                r.media_type, r.format, r.original_size, r.compressed_size,
                r.skipped as i64, r.skip_reason, r.error_message, r.completed_at_ms,
            ],
        ).map_err(|e| format!("insert_record: {}", e))?;
        Ok(())
    }

    /// 세션 종료 — 집계 값(done/failed/skipped/bytes)을 한 번에 업데이트.
    pub fn end_session(
        &self,
        session_id: &str,
        done_count: i64,
        failed_count: i64,
        skipped_count: i64,
        total_original: i64,
        total_compressed: i64,
    ) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        c.execute(
            r#"update compression_sessions
               set ended_at_ms = ?1,
                   done_count = ?2,
                   failed_count = ?3,
                   skipped_count = ?4,
                   total_original_bytes = ?5,
                   total_compressed_bytes = ?6
               where session_id = ?7"#,
            params![now, done_count, failed_count, skipped_count,
                    total_original, total_compressed, session_id],
        ).map_err(|e| format!("end_session: {}", e))?;
        Ok(())
    }

    /// 특정 input_path가 이미 성공적으로 압축된 적 있는지 — P5 skip 룰 근거.
    pub fn find_successful_record(&self, input_path: &str) -> Result<Option<CompressionRecord>, String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        let got = c.query_row(
            r#"select id, session_id, file_name, input_path, output_path, media_type, format,
                      original_size, compressed_size, skipped, skip_reason, error_message, completed_at_ms
               from compression_records
               where input_path = ?1 and skipped = 0 and error_message is null
               order by completed_at_ms desc
               limit 1"#,
            params![input_path],
            |row| {
                Ok(CompressionRecord {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    file_name: row.get(2)?,
                    input_path: row.get(3)?,
                    output_path: row.get(4)?,
                    media_type: row.get(5)?,
                    format: row.get(6)?,
                    original_size: row.get(7)?,
                    compressed_size: row.get(8)?,
                    skipped: row.get::<_, i64>(9)? != 0,
                    skip_reason: row.get(10)?,
                    error_message: row.get(11)?,
                    completed_at_ms: row.get(12)?,
                })
            },
        ).optional().map_err(|e| e.to_string())?;
        Ok(got)
    }

    pub fn recent_sessions(&self, limit: i64) -> Result<Vec<CompressionSession>, String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = c.prepare(
            r#"select session_id, session_type, root_path, started_at_ms, ended_at_ms,
                      total_count, done_count, failed_count, skipped_count,
                      total_original_bytes, total_compressed_bytes
               from compression_sessions
               order by started_at_ms desc
               limit ?1"#,
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![limit], |row| {
            Ok(CompressionSession {
                session_id: row.get(0)?,
                session_type: row.get(1)?,
                root_path: row.get(2)?,
                started_at_ms: row.get(3)?,
                ended_at_ms: row.get(4)?,
                total_count: row.get(5)?,
                done_count: row.get(6)?,
                failed_count: row.get(7)?,
                skipped_count: row.get(8)?,
                total_original_bytes: row.get(9)?,
                total_compressed_bytes: row.get(10)?,
            })
        }).map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows { out.push(r.map_err(|e| e.to_string())?); }
        Ok(out)
    }
}
