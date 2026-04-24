// 수신 파일 메타데이터 DB. rusqlite + bundled SQLite.
// cross-platform: mac/windows/linux 모두 동일 코드, 시스템 SQLite 의존 없음.
//
// 저장 위치: <앱 데이터 디렉토리>/velo-sync.db
//   - macOS: ~/Library/Application Support/com.smileon.velo/
//   - Windows: %APPDATA%\com.smileon.velo\
//   - Linux: ~/.local/share/com.smileon.velo/

use rusqlite::{Connection, OptionalExtension, params};
use std::path::PathBuf;
use std::sync::Mutex;

// 델타 계산용 경량 엔트리 — full record 없이 식별자만.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InventoryEntry {
    pub content_hash: String,
    pub phone_asset_id: Option<String>,
    pub file_name: String,
    pub file_size: i64,
    pub received_at_ms: i64,
}

// 기기별 수신 통계 — 대시보드 표시용.
// from_device_id가 NULL인 레코드는 하나의 "알 수 없는 기기" 그룹으로 집계.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeviceStat {
    pub device_id: Option<String>,
    pub mdns_name: Option<String>,
    pub file_count: i64,
    pub total_bytes: i64,
    pub last_received_at_ms: i64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ReceivedRecord {
    pub content_hash: String,
    pub file_name: String,
    pub file_size: i64,
    pub media_type: Option<String>,
    pub from_device_id: Option<String>,
    pub from_mdns_name: Option<String>,
    pub phone_asset_id: Option<String>,
    pub local_path: String,
    pub received_at_ms: i64,
}

pub struct SyncStore {
    conn: Mutex<Connection>,
}

impl SyncStore {
    pub fn open(db_path: PathBuf) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("db dir: {}", e))?;
        }
        let conn = Connection::open(&db_path).map_err(|e| format!("open db: {}", e))?;
        let store = SyncStore { conn: Mutex::new(conn) };
        store.migrate()?;
        Ok(store)
    }

    fn migrate(&self) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        c.execute_batch(r#"
            create table if not exists received_files (
              id integer primary key autoincrement,
              content_hash text not null unique,
              file_name text not null,
              file_size integer not null,
              media_type text,
              from_device_id text,
              from_mdns_name text,
              phone_asset_id text,
              local_path text not null,
              received_at_ms integer not null
            );
            create index if not exists received_files_device_idx
              on received_files(from_device_id, received_at_ms desc);
            create index if not exists received_files_hash_idx
              on received_files(content_hash);
        "#).map_err(|e| format!("migrate: {}", e))
    }

    pub fn upsert(&self, r: &ReceivedRecord) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        c.execute(
            r#"insert into received_files
               (content_hash, file_name, file_size, media_type, from_device_id,
                from_mdns_name, phone_asset_id, local_path, received_at_ms)
               values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
               on conflict(content_hash) do update set
                 file_name = excluded.file_name,
                 file_size = excluded.file_size,
                 local_path = excluded.local_path,
                 received_at_ms = excluded.received_at_ms,
                 from_device_id = coalesce(excluded.from_device_id, from_device_id),
                 from_mdns_name = coalesce(excluded.from_mdns_name, from_mdns_name),
                 phone_asset_id = coalesce(excluded.phone_asset_id, phone_asset_id)"#,
            params![
                r.content_hash, r.file_name, r.file_size, r.media_type,
                r.from_device_id, r.from_mdns_name, r.phone_asset_id,
                r.local_path, r.received_at_ms,
            ],
        ).map_err(|e| format!("upsert: {}", e))?;
        Ok(())
    }

    pub fn exists(&self, content_hash: &str) -> Result<bool, String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        let got: Option<i64> = c.query_row(
            "select 1 from received_files where content_hash = ?1 limit 1",
            params![content_hash],
            |row| row.get(0),
        ).optional().map_err(|e| e.to_string())?;
        Ok(got.is_some())
    }

    pub fn list_recent(&self, limit: i64) -> Result<Vec<ReceivedRecord>, String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = c.prepare(
            r#"select content_hash, file_name, file_size, media_type,
                      from_device_id, from_mdns_name, phone_asset_id,
                      local_path, received_at_ms
               from received_files
               order by received_at_ms desc
               limit ?1"#
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![limit], |row| {
            Ok(ReceivedRecord {
                content_hash: row.get(0)?,
                file_name: row.get(1)?,
                file_size: row.get(2)?,
                media_type: row.get(3)?,
                from_device_id: row.get(4)?,
                from_mdns_name: row.get(5)?,
                phone_asset_id: row.get(6)?,
                local_path: row.get(7)?,
                received_at_ms: row.get(8)?,
            })
        }).map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
        Ok(out)
    }

    /// 특정 폰(device_id)에서 받은 모든 레코드의 핵심 식별자만 반환.
    /// 폰이 델타 계산에 사용 — "이미 보낸 asset은 skip"
    pub fn inventory_for_device(&self, device_id: &str) -> Result<Vec<InventoryEntry>, String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = c.prepare(
            r#"select content_hash, phone_asset_id, file_name, file_size, received_at_ms
               from received_files
               where from_device_id = ?1
               order by received_at_ms desc"#
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![device_id], |row| {
            Ok(InventoryEntry {
                content_hash: row.get(0)?,
                phone_asset_id: row.get(1)?,
                file_name: row.get(2)?,
                file_size: row.get(3)?,
                received_at_ms: row.get(4)?,
            })
        }).map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows { out.push(r.map_err(|e| e.to_string())?); }
        Ok(out)
    }

    /// 기기별 수신 통계 집계 — 파일 수, 총 용량, 마지막 수신 시각.
    /// from_mdns_name은 같은 device_id라도 기기 이름이 바뀌었을 수 있으니 MAX로 최근 값 사용.
    pub fn device_stats(&self) -> Result<Vec<DeviceStat>, String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = c.prepare(
            r#"select from_device_id,
                      max(from_mdns_name),
                      count(*),
                      coalesce(sum(file_size), 0),
                      max(received_at_ms)
               from received_files
               group by from_device_id
               order by max(received_at_ms) desc"#
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(DeviceStat {
                device_id: row.get(0)?,
                mdns_name: row.get(1)?,
                file_count: row.get(2)?,
                total_bytes: row.get(3)?,
                last_received_at_ms: row.get(4)?,
            })
        }).map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows { out.push(r.map_err(|e| e.to_string())?); }
        Ok(out)
    }

    pub fn delete_by_hash(&self, content_hash: &str) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        c.execute(
            "delete from received_files where content_hash = ?1",
            params![content_hash],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }
}
