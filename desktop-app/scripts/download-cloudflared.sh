#!/usr/bin/env bash
#
# cloudflared 사이드카 바이너리 다운로드 — 빌드 전 1회 실행.
#
# 동작:
#   - 현재 호스트의 Rust target triple 자동 감지
#   - Cloudflare 공식 GitHub Releases에서 해당 플랫폼 바이너리 받기
#   - src-tauri/binaries/cloudflared-{triple}[.exe] 위치에 저장 → Tauri externalBin이 픽업
#
# 사용:
#   ./scripts/download-cloudflared.sh
#
# 크로스 플랫폼:
#   - Windows: Git Bash / WSL에서 실행
#   - macOS / Linux: 기본 bash로 실행
#
# 매번 최신 stable 다운로드 — cloudflared는 자동 업데이트 비활성(--no-autoupdate)이라
# 빌드 시점 버전 고정과 동일.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINARIES_DIR="$SCRIPT_DIR/../src-tauri/binaries"

mkdir -p "$BINARIES_DIR"

# Rust target triple 감지 (rustc --version --verbose 의 host 라인).
if ! command -v rustc >/dev/null 2>&1; then
    echo "error: rustc not found. Install Rust toolchain first."
    exit 1
fi
TRIPLE="$(rustc -vV | sed -n 's|host: ||p')"
if [ -z "$TRIPLE" ]; then
    echo "error: failed to detect Rust target triple."
    exit 1
fi

# triple → Cloudflare 릴리스 자산 매핑
case "$TRIPLE" in
    aarch64-apple-darwin)
        ASSET="cloudflared-darwin-arm64.tgz"
        ARCHIVE="tgz"
        EXT=""
        ;;
    x86_64-apple-darwin)
        ASSET="cloudflared-darwin-amd64.tgz"
        ARCHIVE="tgz"
        EXT=""
        ;;
    x86_64-pc-windows-msvc | x86_64-pc-windows-gnu)
        ASSET="cloudflared-windows-amd64.exe"
        ARCHIVE="exe"
        EXT=".exe"
        ;;
    aarch64-pc-windows-msvc)
        ASSET="cloudflared-windows-arm64.exe"
        ARCHIVE="exe"
        EXT=".exe"
        ;;
    x86_64-unknown-linux-gnu)
        ASSET="cloudflared-linux-amd64"
        ARCHIVE="raw"
        EXT=""
        ;;
    aarch64-unknown-linux-gnu)
        ASSET="cloudflared-linux-arm64"
        ARCHIVE="raw"
        EXT=""
        ;;
    *)
        echo "error: unsupported target triple: $TRIPLE"
        echo "       cloudflared 미지원 플랫폼이거나 매핑 추가 필요."
        exit 1
        ;;
esac

URL="https://github.com/cloudflare/cloudflared/releases/latest/download/$ASSET"
DEST="$BINARIES_DIR/cloudflared-${TRIPLE}${EXT}"

echo "[cloudflared] target=$TRIPLE"
echo "[cloudflared] url=$URL"
echo "[cloudflared] dest=$DEST"

case "$ARCHIVE" in
    tgz)
        TMP="$(mktemp -d)"
        trap 'rm -rf "$TMP"' EXIT
        curl -fsSL "$URL" -o "$TMP/cf.tgz"
        tar -xzf "$TMP/cf.tgz" -C "$TMP"
        # 추출된 파일 이름은 'cloudflared' (확장자 없음)
        if [ ! -f "$TMP/cloudflared" ]; then
            echo "error: extracted archive missing 'cloudflared' binary"
            exit 1
        fi
        mv "$TMP/cloudflared" "$DEST"
        ;;
    exe | raw)
        curl -fsSL "$URL" -o "$DEST"
        ;;
esac

chmod +x "$DEST"

# macOS 코드사이닝 — 다운로드한 바이너리는 quarantine 속성 붙어있을 수 있음.
# Tauri 빌드 단계의 codesign이 sidecar도 같이 sign하도록 quarantine 제거.
if [ "$(uname)" = "Darwin" ]; then
    xattr -cr "$DEST" 2>/dev/null || true
fi

# 검증 — 실제 실행 가능한지 --version 호출.
if ! "$DEST" --version >/dev/null 2>&1; then
    echo "warning: cloudflared --version 실행 실패. 바이너리 손상 가능."
fi

VERSION="$("$DEST" --version 2>/dev/null | head -1 || echo 'unknown')"
echo "[cloudflared] ok — $VERSION"
