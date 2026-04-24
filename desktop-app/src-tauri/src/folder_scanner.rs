// 폴더 재귀 스캔 — 폴더 압축 모드의 입력 수집기.
// 하위 모든 폴더를 walk 하며 비디오/이미지 파일만 나열.
//
// 제외:
//   - 이미 압축 결과가 저장되는 `_velo_compressed` 하위 (무한 재처리 방지)
//   - 숨김 파일 ('.' 으로 시작)
//   - 심볼릭 링크 루프 (기본 std::fs::read_dir는 따라가지만 visited guard 없이 depth 제한)

use std::path::{Path, PathBuf};

// Velo가 생성하는 출력 폴더 이름. 스캔 시 항상 건너뜀.
pub const OUTPUT_SUBDIR: &str = "_velo_compressed";

// 너무 깊은 디렉토리 트리에서 무한 재귀 방지.
const MAX_DEPTH: usize = 20;

const VIDEO_EXTS: &[&str] = &[
    "mp4", "mov", "mkv", "avi", "webm", "m4v", "wmv", "flv", "mpeg", "mpg"
];
const IMAGE_EXTS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "bmp", "gif", "heic", "heif"
];

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ScannedFile {
    pub path: String,
    pub file_name: String,
    pub size: u64,
    pub media_type: String, // "video" | "image"
    // 유저에게 보여줄 "루트로부터의 상대 경로" — 같은 파일명이 여러 하위 폴더에 있을 때 식별용.
    pub relative_path: String,
}

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub root_path: String,
    pub total_count: usize,
    pub total_bytes: u64,
    pub video_count: usize,
    pub image_count: usize,
    pub files: Vec<ScannedFile>,
}

pub fn scan(root: &Path) -> Result<ScanResult, String> {
    if !root.is_dir() {
        return Err(format!("not a directory: {}", root.display()));
    }

    let mut files = Vec::new();
    walk(root, root, 0, &mut files)?;

    let total_bytes = files.iter().map(|f| f.size).sum();
    let video_count = files.iter().filter(|f| f.media_type == "video").count();
    let image_count = files.iter().filter(|f| f.media_type == "image").count();

    Ok(ScanResult {
        root_path: root.to_string_lossy().to_string(),
        total_count: files.len(),
        total_bytes,
        video_count,
        image_count,
        files,
    })
}

fn walk(root: &Path, current: &Path, depth: usize, out: &mut Vec<ScannedFile>) -> Result<(), String> {
    if depth > MAX_DEPTH {
        return Ok(());
    }

    let entries = match std::fs::read_dir(current) {
        Ok(e) => e,
        // 권한 없는 디렉토리 등은 조용히 건너뜀 — 전체 스캔은 중단하지 않음.
        Err(_) => return Ok(()),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = match path.file_name().and_then(|s| s.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        // 숨김 파일/폴더 제외 (`.DS_Store`, `.git` 등).
        if file_name.starts_with('.') {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        if metadata.is_dir() {
            // 출력 폴더 제외 — 재처리 무한 루프 방지.
            if file_name == OUTPUT_SUBDIR {
                continue;
            }
            walk(root, &path, depth + 1, out)?;
            continue;
        }

        if !metadata.is_file() {
            continue;
        }

        let media_type = match classify(&path) {
            Some(t) => t,
            None => continue,
        };

        let relative_path = path
            .strip_prefix(root)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| file_name.clone());

        out.push(ScannedFile {
            path: path.to_string_lossy().to_string(),
            file_name,
            size: metadata.len(),
            media_type: media_type.to_string(),
            relative_path,
        });
    }

    Ok(())
}

fn classify(path: &Path) -> Option<&'static str> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())?;
    if VIDEO_EXTS.contains(&ext.as_str()) {
        Some("video")
    } else if IMAGE_EXTS.contains(&ext.as_str()) {
        Some("image")
    } else {
        None
    }
}

/// 압축 출력 경로 계산 — `{원본 파일의 폴더}/_velo_compressed/{원본파일명(확장자 바뀐)}`.
/// 자동 출력 정책 확정 사항. P3에서 호출.
#[allow(dead_code)]
pub fn output_path_for(input_path: &Path, output_ext: &str) -> PathBuf {
    let parent = input_path.parent().unwrap_or(Path::new("."));
    let stem = input_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    parent
        .join(OUTPUT_SUBDIR)
        .join(format!("{}.{}", stem, output_ext))
}
