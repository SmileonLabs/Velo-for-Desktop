# mDNS 우선 + WiFi Direct 보조 — D2 후속 재설계 계획

**작성**: 2026-04-27
**작성자**: 이 실장 (Windows 머신에서 검증 후 인계)
**대상**: Mac에서 코드 작업 진행
**상태**: D2 빌드 통과(`50582ff`), 실기 테스트 전 — 발견 흐름 우선순위 재정리 단계

---

## 1. 결정 사항

대화에서 확정된 방향:

1. **메인 발견 흐름은 mDNS LAN** — 같은 공유기 환경(집/사무실)에서 자동 발견
2. **WiFi Direct는 보조** — WiFi 어댑터 있고 mDNS 안 될 때(외부, 다른 망)
3. **랜선 데스크탑(WiFi 어댑터 없음)** — WiFi Direct 토글 자체 숨김, mDNS만 사용

이유:
- WiFi Direct는 무선 어댑터 필수 → 랜선 데스크탑에서 동작 불가
- 대부분의 Velo 사용자는 폰+데스크탑 같은 공유기 환경 → mDNS로 충분
- WiFi Direct 표준 페어링은 PIN/PBC라 SSID/passphrase 입력 자체가 부자연스러움

---

## 2. 현재 코드 상태 (Windows 머신에서 직접 확인)

### Rust (`desktop-app/src-tauri/src/`)

| 파일 | 역할 | 상태 |
|------|------|------|
| `mdns_advertiser.rs` | `_velo._tcp.local` 광고 (자기 device_id/name/version 송출) | 이미 동작 |
| `sync_server.rs` | 파일 수신 HTTP 서버 | 동작 |
| `sync_store.rs` | 받은 파일 DB 기록 | 동작 |
| `wifi_direct.rs` | Windows.Devices.WiFiDirect 페어링 | **컴파일 통과(50582ff), 실기 미검증** |
| `folder_scanner.rs` | 로컬 폴더 스캔 | 동작 |
| `compression_store.rs` | 압축 파일 처리 | 동작 |

### lib.rs

- mod로 등록된 모듈: `sync_server`, `mdns_advertiser`, `sync_store`, `folder_scanner`, `compression_store`, `wifi_direct`
- tauri::command 24개 등록
- `mdns_advertiser`는 광고만 — **discover(브라우저) 미구현**

### Frontend (`desktop-app/src/`)

| 파일 | 역할 |
|------|------|
| `components/WifiDirectPairModal.tsx` | SSID/비번 입력 모달 (현재 메인 페어링 UI) |
| `components/Header.tsx` | "WiFi Direct" 버튼 |
| `components/ReceivedFilesModal.tsx` | 받은 파일 목록 |
| `App.tsx`, `deviceRegistration.ts` | 메인 + 디바이스 등록 |

---

## 3. 핵심 갭

**현재**: 자기 자신은 mDNS로 광고만 하고, **상대방 광고를 듣는(browse) 코드는 없음**.
즉 데스크탑이 폰을 자동으로 "발견"하지 못함. 폰이 데스크탑을 발견하는 한 방향만 동작.

→ **`mdns_discoverer.rs` 신규 구현 필요** (가장 큰 작업).

---

## 4. 작업 범위 (Mac에서 진행)

### A. mDNS Discoverer 구현 [P0, ~2시간]

신규 파일: `desktop-app/src-tauri/src/mdns_discoverer.rs`

`mdns-sd` crate의 `ServiceDaemon::browse()` 사용 (이미 의존성 추가됨).

**API 설계**:

```rust
#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredDevice {
    pub device_id: String,
    pub device_name: String,
    pub ip: String,
    pub port: u16,
    pub version: String,
}

pub struct MdnsBrowserHandle { /* ... */ }

pub fn start_browse(
    own_device_id: String,  // 자기 자신 필터링용
) -> Result<MdnsBrowserHandle, String>;

// 현재까지 발견된 디바이스 목록 (스냅샷)
pub fn list_devices(handle: &MdnsBrowserHandle) -> Vec<DiscoveredDevice>;
```

**lib.rs에 tauri command 추가**:

```rust
#[tauri::command]
async fn discover_devices(state: State<'_, AppState>) -> Result<Vec<DiscoveredDevice>, String>;

#[tauri::command]
async fn start_device_discovery(state: State<'_, AppState>) -> Result<(), String>;
```

### B. WiFi 어댑터 감지 [P1, ~1시간]

`wifi_direct.rs`의 `is_supported()` 보강:

```rust
pub fn is_supported() -> bool {
    cfg!(target_os = "windows") && windows_impl::has_wifi_adapter()
}

#[cfg(target_os = "windows")]
mod windows_impl {
    use windows::Networking::Connectivity::NetworkInformation;

    pub fn has_wifi_adapter() -> bool {
        // 옵션 1: NetworkInformation::GetConnectionProfiles()
        //   → IsWlanConnectionProfile() == true 인 게 있는지
        // 옵션 2: Win32 WlanAPI (windows = "0.61", features = ["Win32_NetworkManagement_WiFi"])
        //   → WlanOpenHandle + WlanEnumInterfaces
        //
        // 옵션 1이 더 간결 (이미 Networking_Connectivity feature 활성)
        match NetworkInformation::GetConnectionProfiles() {
            Ok(profiles) => (0..profiles.Size().unwrap_or(0))
                .filter_map(|i| profiles.GetAt(i).ok())
                .any(|p| p.IsWlanConnectionProfile().unwrap_or(false)),
            Err(_) => false,
        }
    }
}
```

> 주의: `IsWlanConnectionProfile()`은 *현재 연결된* 프로파일 기준. 어댑터가 있어도 비활성이면 false 가능. 정확한 어댑터 enumeration이 필요하면 Win32 WlanAPI(`Win32_NetworkManagement_WiFi` feature)로 전환. D2에선 옵션 1로 충분.

### C. Frontend UI 재구성 [P0, ~3시간]

**현재 흐름**:
```
Header [WiFi Direct 버튼] → WifiDirectPairModal (SSID/비번 input)
```

**변경 후 흐름**:
```
Header [디바이스 연결 버튼] → DeviceConnectModal
  ├── 섹션 1: mDNS 발견 디바이스 리스트 (실시간 갱신)
  │   └── 각 디바이스: "연결" 버튼
  ├── 섹션 2 (어댑터 있을 때만): "WiFi Direct로 직접 연결" 보조 옵션
  │   └── 클릭 시 기존 WifiDirectPairModal 흐름
  └── 섹션 3 (어댑터 없을 때): "같은 공유기에 연결되어 있나요?" 안내
```

**컴포넌트 변경**:
- 신규: `DeviceConnectModal.tsx` (메인 페어링 진입점)
- 기존 `WifiDirectPairModal.tsx`: 보조로 격하 (이름은 유지하되 modal 내 sub-flow로)
- `Header.tsx`: 버튼 텍스트 "WiFi Direct" → "디바이스 연결"
- 신규 hook: `useDiscoveredDevices` — `discover_devices` invoke + 1~2초 polling 또는 tauri event 구독

**디바이스 표시 로직**:
- 자기 자신 제외 (own device_id 비교)
- 같은 계정의 디바이스만 표시 (Supabase user_devices 테이블의 device_id와 매칭)
  → 다른 사람 폰이 같은 카페 LAN에 있어도 안 보이게

### D. 안드 측 통합 검증 [P1, ~2시간 — 레토님 협업]

- 안드가 이미 `_velo._tcp.local`로 광고하는지 확인
- TXT 필드: `device_id`, `device_name`, `version` 일치 확인
- 안드의 device_id가 Supabase user_devices 테이블에 등록된 값과 동일한지 (자동 매칭 위해)

---

## 5. 우선순위

| Pri | 작업 | 비고 |
|-----|------|------|
| P0 | A. mDNS Discoverer + tauri command | 메인 흐름의 핵심 |
| P0 | C. Frontend DeviceConnectModal | UI 진입점 |
| P1 | B. WiFi 어댑터 감지 | 랜선 사용자 UX |
| P1 | C2. Frontend conditional 토글 | B 의존 |
| P2 | D. 안드 통합 테스트 | 레토님 영역 |
| P2 | wifi_direct.rs 실기 테스트 (D3) | mDNS 우선 흐름 후순위로 밀림 |

---

## 6. 예상 소요 시간

- A: ~2시간
- B: ~1시간
- C: ~3시간
- D: ~2시간 (협업)
- 통합 테스트: ~2시간

**합계: 1~2일** (집중 작업 기준)

---

## 7. 주의사항

1. **mdns_advertiser는 그대로 유지** — 안드가 윈도우를 발견할 수 있어야 양방향 동작
2. **자기 자신 필터링 필수** — discoverer가 자기 mdns_advertiser 광고를 잡으면 안 됨 (`device_id` 비교)
3. **Windows Defender/방화벽** — mDNS UDP 5353 첫 실행 시 권한 요청 팝업 가능. 사용자 안내 필요
4. **공유기의 mDNS 차단** — 일부 공유기(특히 게스트 네트워크)는 multicast 차단. 발견 안 될 때 fallback 안내 필요
5. **Cargo.toml 변경 시 Mac에서 cargo check 다시** — Windows에서만 추가한 의존성이 macOS 빌드에 영향 없는지 확인
6. **WiFi Direct 코드(`wifi_direct.rs`)는 그대로 둠** — 보조 흐름으로 남겨야 함. 다만 `pair(ssid, passphrase)` 시그니처는 보조 흐름에 맞게 D3에서 재검토

---

## 8. Windows 머신 환경 (현재 상태)

다음 작업자가 이 머신에서 빌드하려면:

- 위치: `C:\Users\kjki1\Velo-for-Desktop`
- 환경 셋업 완료: Rust 1.95.0, Node 24.15.0, Git 2.54, gh CLI(`SmileonLabs` 로그인)
- VS 2022 Community 설치됨
- ffmpeg/ffprobe sidecar 배치 완료 (`desktop-app/src-tauri/binaries/`, .gitignore 처리됨)
- `desktop-app/.env` 작성 완료 (Supabase URL/anon key)
- `npm run tauri dev` 실행 가능 (Vite 1420 + velo.exe)

Mac에서 작업한 결과를 push하면 이 머신에서 `git pull` + `cargo build` 또는 `npm run tauri dev`로 검증 가능.

---

## 9. 관련 문서

- `MD/개발/wifi_direct-cargo-check-에러-보고.md` — D2 빌드 에러 보고 (해결 완료)
- 관련 커밋: `dc64be0` (D1) / `ea05073` (D2) / `a17d4af` (D5) / `50582ff` (D2 fix)
