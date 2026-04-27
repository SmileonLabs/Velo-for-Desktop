// Wi-Fi Direct (P2P) 클라이언트 — Windows 전용.
// 안드 측이 P2P Group Owner로 만든 임시 SSID에 데스크탑이 자동 페어링.
//
// 플랫폼 분기:
//   - Windows: Windows.Devices.WiFiDirect (WinRT) API 사용
//   - macOS / Linux: Apple/플랫폼 정책상 정식 미지원 — 더미 stub만 두고 호출 시 에러 반환
//
// 책임 범위:
//   1. 안드 P2P 그룹 SSID 부분 매칭 → 자동 페어링
//   2. 연결 성공 시 mDNS 발견은 기존 sync_server·sync_store가 자동 수행
//   3. 연결 해제 / 그룹 사라지면 OS가 알아서 정리
//
// passphrase 메모: WiFi Direct 표준 페어링은 PIN/PBC 방식이라 passphrase를 직접 사용하지 않음.
// 그래도 시그니처는 유지 — 안드 호환성 검증 후 WlanAPI 전환 시 활용 예정.

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WifiDirectPairResult {
    pub success: bool,
    pub message: String,
}

/// 안드 P2P 그룹 SSID에 페어링 시도.
/// macOS·Linux는 즉시 미지원 응답 — 호출자(프론트)가 사용자에게 안내.
#[allow(unused_variables)]
pub async fn pair(ssid: String, passphrase: String) -> Result<WifiDirectPairResult, String> {
    #[cfg(target_os = "windows")]
    {
        windows_impl::pair(&ssid, &passphrase).await
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(WifiDirectPairResult {
            success: false,
            message: "Wi-Fi Direct 자동 페어링은 Windows에서만 지원됩니다. \
                     이 OS에서는 Wi-Fi 메뉴에서 SSID 직접 선택 또는 같은 공유기 LAN 사용을 권장합니다."
                .to_string(),
        })
    }
}

/// 이 OS에서 Wi-Fi Direct 자동 페어링 가능 여부. UI 토글 표시 결정에 사용.
/// Windows라도 Wi-Fi 어댑터가 없으면 (랜선 데스크탑 등) false.
pub fn is_supported() -> bool {
    #[cfg(target_os = "windows")]
    {
        windows_impl::has_wifi_adapter()
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

// MARK: - Windows 구현 — Microsoft 공식 WiFi Direct 페어링 패턴
//
// Microsoft 권장 흐름:
//   1) WiFiDirectDevice::GetDeviceSelector — 발견 selector 획득
//   2) DeviceInformation::FindAllAsyncAqsFilter(selector) — 주변 P2P 광고 수집
//   3) SSID 부분 매칭 (Name contains)
//   4) WiFiDirectConnectionParameters 생성 + GroupOwnerIntent=0 (안드가 GO이므로 윈도우는 client)
//   5) WiFiDirectDevice::FromIdAsync2(deviceId, connectionParams) — 페어링 + 연결 동시 트리거
//   6) device.ConnectionStatus() == Connected 확인
//
// 참고: <https://learn.microsoft.com/en-us/uwp/api/windows.devices.wifidirect.wifidirectdevice.fromidasync>
#[cfg(target_os = "windows")]
mod windows_impl {
    use super::WifiDirectPairResult;
    use windows::Devices::Enumeration::DeviceInformation;
    use windows::Devices::WiFiDirect::{
        WiFiDirectConnectionParameters, WiFiDirectConnectionStatus, WiFiDirectDevice,
    };
    use windows::Networking::Connectivity::NetworkInformation;

    /// Wi-Fi 어댑터(또는 활성 WLAN 프로파일) 존재 여부.
    /// 랜선만 연결된 데스크탑은 false → UI에서 WiFi Direct 보조 옵션 자동 숨김.
    pub fn has_wifi_adapter() -> bool {
        match NetworkInformation::GetConnectionProfiles() {
            Ok(profiles) => (0..profiles.Size().unwrap_or(0))
                .filter_map(|i| profiles.GetAt(i).ok())
                .any(|p| p.IsWlanConnectionProfile().unwrap_or(false)),
            Err(_) => false,
        }
    }

    pub async fn pair(ssid: &str, _passphrase: &str) -> Result<WifiDirectPairResult, String> {
        // 1) WiFi Direct 페어링 가능 디바이스 selector.
        let selector = WiFiDirectDevice::GetDeviceSelector()
            .map_err(|e| format!("GetDeviceSelector: {}", e))?;

        // 2) 주변 P2P 광고 검색 (단순 AqsFilter 형태로 — Kind는 selector에 이미 포함).
        let devices = DeviceInformation::FindAllAsyncAqsFilter(&selector)
            .map_err(|e| format!("FindAllAsync init: {}", e))?
            .await
            .map_err(|e| format!("FindAllAsync await: {}", e))?;

        // 3) SSID 부분 매칭 — 안드 P2P GO는 보통 "DIRECT-xx-Velo..." 형식.
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

        // 4) ConnectionParameters — 안드가 GO이므로 윈도우는 client (intent=0).
        let conn_params = WiFiDirectConnectionParameters::new()
            .map_err(|e| format!("ConnectionParameters: {}", e))?;
        conn_params
            .SetGroupOwnerIntent(0)
            .map_err(|e| format!("SetGroupOwnerIntent: {}", e))?;

        // 5) FromIdAsync2 — 2-arg overload (deviceId + connectionParams).
        //    이 호출 자체가 "페어링 + 연결" 트리거.
        let device_id = target.Id().map_err(|e| format!("Id: {}", e))?;
        let device = WiFiDirectDevice::FromIdAsync2(&device_id, &conn_params)
            .map_err(|e| format!("FromIdAsync init: {}", e))?
            .await
            .map_err(|e| format!("FromIdAsync await: {}", e))?;

        // 6) 연결 상태 확인.
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
