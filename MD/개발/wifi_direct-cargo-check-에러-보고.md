# wifi_direct.rs cargo check 에러 보고

**작성**: 2026-04-27
**작성자**: 이 실장
**대상 파일**: `desktop-app/src-tauri/src/wifi_direct.rs`
**작업 환경**: Windows 10 Pro 22H2 / rustc 1.95.0 / windows crate 0.58
**관련 커밋**: `dc64be0` (D1) / `ea05073` (D2) / `a17d4af` (D5)

---

## 1. 사전 처리 (이미 해결)

### 1.1 ffmpeg/ffprobe sidecar 누락

`tauri.conf.json` `bundle.externalBin`에 `binaries/ffmpeg`, `binaries/ffprobe` 등록돼 있으나 실제 exe가 repo에 없어 `tauri-build`가 빌드 전 검증에서 실패.

```
resource path `binaries\ffmpeg-x86_64-pc-windows-msvc.exe` doesn't exist
```

**처리**: gyan.dev essentials 빌드(ffmpeg 8.1)에서 추출 후 sidecar 명명 규칙대로 배치.
- `desktop-app/src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe` (~96MB)
- `desktop-app/src-tauri/binaries/ffprobe-x86_64-pc-windows-msvc.exe` (~96MB)

> 주의: `.gitignore`에 `binaries/` 포함 여부 확인 필요. 안 되어 있으면 100MB exe 두 개가 git에 들어감.

---

## 2. 발견한 컴파일 에러 (3건)

### 2.1 E0433 — DevicePairingSettings를 찾을 수 없음

```
error[E0433]: cannot find `DevicePairingSettings` in `Enumeration`
   --> src\wifi_direct.rs:115:49
    |
115 |                 &windows::Devices::Enumeration::DevicePairingSettings::new()
    |                                                 ^^^^^^^^^^^^^^^^^^^^^
help: a struct with a similar name exists
    |
115 |                 &windows::Devices::Enumeration::IDevicePairingSettings::new()
```

**원인**:
`Windows.Devices.Enumeration.DevicePairingSettings`는 **추상 인터페이스**(IDevicePairingSettings)로, 직접 인스턴스화 불가. 디바이스 클래스별 custom pairing settings 구현체를 사용해야 함.

WiFi Direct 페어링 시 사용해야 하는 settings 구현체는 `Windows.Devices.WiFiDirect.WiFiDirectConnectionParameters`임 (Microsoft 공식 패턴).

### 2.2 E0599 — FindAllAsyncAqsFilterAndKind 메서드 없음

```
error[E0599]: no associated item named `FindAllAsyncAqsFilterAndKind` found for struct `DeviceInformation`
   --> src\wifi_direct.rs:69:42
    |
 69 |         let devices = DeviceInformation::FindAllAsyncAqsFilterAndKind(
```

**원인**:
windows-rs는 C# overload 충돌을 회피하기 위해 인자명을 메서드명에 풀어쓴다. 3-arg overload(`aqsFilter` + `additionalProperties` + `kind`)의 정확한 이름은:

```
FindAllAsyncAqsFilterAndAdditionalPropertiesAndKind
```

현재 코드는 중간의 `AdditionalProperties`가 빠져있음. 또는 그 인자가 필요 없으면 단순 2-arg `FindAllAsyncAqsFilter`(filter only)를 사용해야 함.

### 2.3 E0277 — IAsyncOperation이 future가 아님

```
error[E0277]: `IAsyncOperation<WiFiDirectDevice>` is not a future
   --> src\wifi_direct.rs:101:14
    |
101 |             .await
    |              ^^^^^ `IAsyncOperation<WiFiDirectDevice>` is not a future
```

**원인**:
windows-rs **0.58은 `IAsyncOperation<T>`에 `IntoFuture` 트레이트 미구현**. 0.59+ 부터 자동 await 지원.

> 참고: 다른 `.await` 두 개(line 75, 119)는 같은 문제이지만, 위에서 더 일찍 컴파일이 실패해 컴파일러가 그 라인까지 도달하지 못해 에러 미표시. windows 0.58 그대로 가면 모두 실패할 것.

---

## 2-2. 진단용 stub 빌드 결과 (wifi_direct.rs 외 코드 검증)

`wifi_direct.rs`만 더미 stub으로 임시 교체 후 `cargo build --keep-going` 실행:

```
Compiling velo v1.0.1 (...)
Finished `dev` profile [unoptimized + debuginfo] target(s) in 53.01s
```

**결과**: 빌드 성공 (exit 0, warning 0건), `target/debug/velo.exe` (25MB) + `velo_lib.dll` 생성 확인.

**의미**: `wifi_direct.rs` 외에는 컴파일·링크 양쪽 모두 깨끗. **이 파일 하나만 고치면 전체 빌드 통과.**

> 검증 후 wifi_direct.rs는 원본으로 즉시 원복. git diff 없음.

---

## 3. 추가 발견 — 설계 결함

`wifi_direct.rs`의 페어링 흐름이 두 가지 패턴을 섞어 쓰고 있어, 컴파일이 통과하더라도 런타임에 의도대로 동작하지 않을 가능성 높음.

### 3.1 현재 코드의 흐름

```rust
// (1) WiFiDirectDevice::FromIdAsync로 device 인스턴스 획득 → 결과 버림 (`let _ =`)
// (2) target.Pairing()으로 DeviceInformationPairing 획득
// (3) pairing.PairWithProtectionLevelAndSettingsAsync(...) 호출
```

→ 이건 **블루투스/일반 페어링 API 패턴**. WiFi Direct는 아님.

### 3.2 Microsoft 공식 WiFi Direct 페어링 패턴

```rust
// (1) WiFiDirectConnectionParameters 생성 + GroupOwnerIntent 등 설정
// (2) WiFiDirectDevice::FromIdAsync(deviceId, connectionParameters) 호출
//     → 이 호출 자체가 "페어링 + 연결" 트리거
// (3) device.ConnectionStatus()로 결과 확인
```

> 공식 문서: <https://learn.microsoft.com/en-us/uwp/api/windows.devices.wifidirect.wifidirectdevice.fromidasync>

### 3.3 안드 P2P GO 시나리오 추가 고려사항

안드로이드 P2P Group Owner가 만드는 SSID는 표준적으로 `DIRECT-xx-...` 형식. **passphrase는 WiFi Direct 표준 페어링(PIN/PBC)에서 직접 사용하지 않음** — passphrase를 받았다는 건 WPS-PSK 방식이라 의미.

**대안 흐름**으로, 단순히 일반 WiFi 네트워크처럼 취급해 `WlanAPI`(Win32, `Win32_NetworkManagement_WiFi` feature)로 SSID + passphrase 직접 연결하는 방법도 있음. 안드 P2P GO는 일반 WiFi AP로도 보이기 때문.

**판단 필요**:
- A) WiFi Direct API 정석 흐름 (PIN/PBC, passphrase 무시) — D2 의도와 일치하나 안드와 호환 검증 필요
- B) WlanAPI 일반 WiFi 연결 (SSID + passphrase) — 호환성 좋지만 코드 전면 재작성

D3에서 실기 테스트 결과 보고 결정 권장.

---

## 4. 해결 방향 (3안)

### 옵션 A — windows crate 0.58 → 0.61 + 정석 WiFiDirect 흐름 재작성 [권장]

**Cargo.toml 수정**:
```toml
[target.'cfg(target_os = "windows")'.dependencies]
windows = { version = "0.61", features = [
    "Devices_WiFiDirect",
    "Devices_Enumeration",
    "Foundation",
    "Foundation_Collections",
    "Networking_Connectivity",
    "Storage_Streams",
] }
```

**wifi_direct.rs 핵심 흐름** (스케치):
```rust
#[cfg(target_os = "windows")]
mod windows_impl {
    use super::WifiDirectPairResult;
    use windows::Devices::Enumeration::DeviceInformation;
    use windows::Devices::WiFiDirect::{
        WiFiDirectConnectionParameters, WiFiDirectConnectionStatus, WiFiDirectDevice,
    };

    pub async fn pair(ssid: &str, _passphrase: &str) -> Result<WifiDirectPairResult, String> {
        // 1) selector
        let selector = WiFiDirectDevice::GetDeviceSelector()
            .map_err(|e| format!("GetDeviceSelector: {}", e))?;

        // 2) 주변 P2P 광고 검색
        let devices = DeviceInformation::FindAllAsyncAqsFilter(&selector)
            .map_err(|e| format!("FindAll init: {}", e))?
            .await
            .map_err(|e| format!("FindAll await: {}", e))?;

        // 3) SSID 부분 매칭
        let target = (0..devices.Size().unwrap_or(0))
            .filter_map(|i| devices.GetAt(i).ok())
            .find(|d| {
                d.Name()
                    .map(|n| n.to_string_lossy().contains(ssid))
                    .unwrap_or(false)
            });

        let target = match target {
            Some(t) => t,
            None => {
                return Ok(WifiDirectPairResult {
                    success: false,
                    message: format!(
                        "주변에서 SSID '{}'를 찾지 못했습니다. 폰에서 호스트가 켜져 있는지 확인하세요.",
                        ssid
                    ),
                });
            }
        };

        // 4) 안드가 GO이므로 윈도우는 client (intent=0)
        let conn_params = WiFiDirectConnectionParameters::new()
            .map_err(|e| format!("ConnectionParameters: {}", e))?;
        conn_params
            .SetGroupOwnerIntent(0)
            .map_err(|e| format!("SetGroupOwnerIntent: {}", e))?;

        // 5) FromIdAsync 2-arg overload — 정확한 이름은 컴파일러 suggestion 따라 조정
        //    (windows-rs는 보통 `FromIdAsync2` 또는 시그니처 풀어쓴 이름 사용)
        let device_id = target.Id().map_err(|e| format!("Id: {}", e))?;
        let device = WiFiDirectDevice::FromIdAsync2(&device_id, &conn_params)
            .map_err(|e| format!("FromIdAsync init: {}", e))?
            .await
            .map_err(|e| format!("FromIdAsync await: {}", e))?;

        // 6) 연결 상태
        let status = device
            .ConnectionStatus()
            .map_err(|e| format!("ConnectionStatus: {}", e))?;
        let success = status == WiFiDirectConnectionStatus::Connected;

        Ok(WifiDirectPairResult {
            success,
            message: if success {
                "페어링 성공".to_string()
            } else {
                format!("페어링 실패 (status={:?})", status)
            },
        })
    }
}
```

**주의점**:
- `FromIdAsync2` 메서드명은 windows-rs 0.61에서 다를 수 있음 (`FromIdAsync` overload가 풀려쓰여짐). 컴파일러 suggestion이 정확한 이름 알려줌.
- `GetGroupOwnerIntent(0)` — 0이면 client 강제, 15면 GO 강제. 안드가 이미 GO이므로 0 권장.
- passphrase는 WiFi Direct 표준 페어링에서 직접 사용 안 함 (PIN/PBC) — 변수만 받고 무시. 호출자(프론트)에 명시 필요.

**예상 작업**: Cargo.toml 1줄 수정 + wifi_direct.rs 재작성 (~80줄) + cargo check 1~2 라운드.

### 옵션 B — windows 0.58 유지 + 메서드명만 수정 + spawn_blocking

`.await` 대신 `tokio::task::spawn_blocking` 안에서 `.get()` 동기 호출.
- 장점: 의존성 변경 최소
- 단점: 코드 지저분, 설계 결함은 그대로

### 옵션 C — windows 0.58 유지 + WiFiDirect 정석 흐름 + spawn_blocking

설계 결함만 수정하고 windows 버전은 그대로.
- 장점: 호환성 검증 부담 없음
- 단점: 모든 async 호출에 spawn_blocking 래핑 필요해 코드 가독성 나쁨

---

## 5. 권장 사항

1. **옵션 A로 진행** — windows 0.61로 업그레이드 + WiFiDirect 정석 흐름.
2. 컴파일 통과 후 `cargo build` 까지 통과 확인 (link-stage 검증).
3. 실기 테스트 (안드 P2P GO 페어링) 후 만약 안드 호환성에 문제 있으면 D3에서 **WlanAPI 일반 WiFi 연결**(옵션 별도 안)로 전환 검토.
4. `binaries/` 가 git에 포함되지 않도록 `.gitignore` 점검 — 만약 안 돼있으면 ffmpeg 100MB가 push될 수 있음.

---

## 6. 결정 필요 사항 (다음 작업자가 진행 전에 확정)

### 6.1 수정 옵션 — A / B / C 중 택1

| 옵션 | 변경 범위 | 장점 | 단점 |
|------|-----------|------|------|
| **A (권장)** | windows 0.58 → 0.61 + WiFiDirect 정석 흐름 재작성 | `.await` 자동 동작, 코드 깔끔, 설계 결함 동시 해결 | 다른 의존성과 windows 버전 충돌 가능성 (Cargo.lock 영향) |
| B | 메서드명만 수정 + `tokio::task::spawn_blocking` 래핑 | 의존성 변경 없음 (가장 안전) | 코드 지저분, 설계 결함 그대로 → 런타임 동작 보장 안 됨 |
| C | windows 0.58 유지 + WiFiDirect 흐름 재작성 + spawn_blocking | 설계 정상화 + 버전 호환성 부담 없음 | 모든 async 호출에 spawn_blocking 래핑 필요 |

**결정 → 보고서 §4 해당 옵션 그대로 적용**

### 6.2 안드 P2P GO 페어링 방식 — WiFi Direct API vs WlanAPI

| 방식 | 설명 | 권장 시점 |
|------|------|-----------|
| **WiFi Direct API** (현재 코드 의도) | `WiFiDirectDevice::FromIdAsync` + `WiFiDirectConnectionParameters` (PIN/PBC) | D2 의도와 일치 — 우선 시도 |
| **WlanAPI** (대안) | Win32 `WlanConnect` + 일반 SSID/passphrase 연결 | 위가 안드와 호환 안 되면 D3에서 전환 |

> passphrase가 있다는 건 WPS-PSK 방식이라 WiFi Direct 표준 페어링(PIN/PBC)과 어긋남. 안드 P2P GO를 일반 WiFi AP로 취급해 WlanAPI로 연결하는 게 더 호환성 좋을 수 있음.

**결정**:
- [ ] D2는 WiFi Direct API로 진행, 실기 테스트 결과 보고 D3에서 재결정
- [ ] D2부터 WlanAPI로 전환 (Cargo.toml에 `Win32_NetworkManagement_WiFi` feature 추가 + 코드 전면 재작성)

### 6.3 ffmpeg/ffprobe sidecar 처리

현재 100MB+ exe 두 개가 `desktop-app/src-tauri/binaries/`에 배치돼 있음. `.gitignore` 점검 필요.

**확인 명령**:
```powershell
cd $HOME\Velo-for-Desktop
git check-ignore desktop-app/src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe
# 출력 있으면 ignore 됨 (정상)
# 출력 없으면 추적됨 → .gitignore 수정 필요
```

**결정**:
- [ ] `.gitignore`에 `desktop-app/src-tauri/binaries/*.exe` 추가 (각자 머신에서 다운로드)
- [ ] 배포 자동화 스크립트(`scripts/`)로 빌드 전 ffmpeg 자동 다운로드
- [ ] Git LFS로 추적 (대용량이지만 버전 고정)

> 권장: 1번. CI/로컬 어디서든 동일하게 다운로드 스크립트로 처리. 빌드 절차에 한 줄 추가.

### 6.4 Cargo.lock 처리

옵션 A/C 선택 시 `cargo update`로 Cargo.lock이 변경됨. 다른 OS(macOS) 빌드에 영향 없는지 확인 필요.

**결정**:
- [ ] Cargo.lock 함께 커밋 (모든 OS에서 동일 의존성 버전 고정 — 권장)
- [ ] Cargo.lock 변경 후 macOS에서도 cargo check 통과 확인하고 커밋

---

## 7. 기타 — 환경 메모

이 머신(C:\Users\kjki1)에서:
- VS 2022 Community (`C:\Program Files\Microsoft Visual Studio\2022\Community`) 확인
- Rust 1.95.0 / cargo 1.95.0 (winget으로 신규 설치)
- Node.js 24.15.0 LTS / npm 11.12.1
- Git 2.54.0 / GitHub CLI 2.91.0 (gh auth login 완료)
- Repo 위치: `C:\Users\kjki1\Velo-for-Desktop` (Desktop이 OneDrive 한글 경로라 홈 직하 ASCII 경로로 clone)
- PowerShell 실행 정책: `RemoteSigned` (CurrentUser, npm.ps1 실행을 위해)

ffmpeg/ffprobe 이미 배치돼 있어 다음 라운드는 sidecar 에러 없이 wifi_direct.rs 컴파일 단계로 바로 진입.
