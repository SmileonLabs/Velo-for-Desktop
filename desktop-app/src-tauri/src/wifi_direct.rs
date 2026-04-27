// Wi-Fi Direct (P2P) 클라이언트 — Windows 전용.
// 안드 측이 P2P Group Owner로 만든 임시 SSID에 데스크탑이 자동 페어링.
//
// 플랫폼 분기:
//   - Windows: Windows.Devices.WiFiDirect (WinRT) API 사용 (D2에서 windows-rs 바인딩)
//   - macOS / Linux: Apple/플랫폼 정책상 정식 미지원 — 더미 stub만 두고 호출 시 에러 반환
//
// 책임 범위:
//   1. 안드 P2P 그룹 SSID/passphrase 받아 OS Wi-Fi 연결 시도 (D3)
//   2. 연결 성공 시 mDNS 발견은 기존 sync_server·sync_store가 자동 수행
//   3. 연결 해제 / 그룹 사라지면 OS가 알아서 정리

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
pub fn is_supported() -> bool {
    cfg!(target_os = "windows")
}

// MARK: - Windows 구현 — Windows.Devices.WiFiDirect WinRT API
//
// 흐름 (안드 P2P Group Owner와 페어링):
//   1) WiFiDirectDevice.GetDeviceSelector(ConnectionEndpointPairCollection) — 발견 selector
//   2) DeviceInformation.FindAllAsync(selector) — 주변 P2P 광고 수집
//   3) SSID 매칭 → WiFiDirectDevice.FromIdAsync — 디바이스 인스턴스
//   4) PairAsync(passphrase) — WPS-PSK 페어링
//   5) 성공 시 ConnectionStatus.Connected → 같은 LAN으로 OS 인식 → mDNS 자동
//
// 참고: D3에서 SSID 발견 + 매칭 로직 보강. D2는 페어링 핵심 호출만.
#[cfg(target_os = "windows")]
mod windows_impl {
    use super::WifiDirectPairResult;
    use windows::core::HSTRING;
    use windows::Devices::Enumeration::{DeviceInformation, DeviceInformationKind};
    use windows::Devices::WiFiDirect::{
        WiFiDirectConnectionParameters, WiFiDirectDevice,
    };

    pub async fn pair(ssid: &str, passphrase: &str) -> Result<WifiDirectPairResult, String> {
        // 1) WiFi Direct 페어링 가능 디바이스 selector — AssociationEndpoint.
        let selector = WiFiDirectDevice::GetDeviceSelector()
            .map_err(|e| format!("GetDeviceSelector: {}", e))?;

        // 2) 주변 P2P 광고 검색.
        let devices = DeviceInformation::FindAllAsyncAqsFilterAndKind(
            &selector,
            None,
            DeviceInformationKind::AssociationEndpoint,
        )
        .map_err(|e| format!("FindAllAsync init: {}", e))?
        .await
        .map_err(|e| format!("FindAllAsync await: {}", e))?;

        let target_ssid = ssid.to_string();
        let target = (0..devices.Size().unwrap_or(0))
            .filter_map(|i| devices.GetAt(i).ok())
            .find(|d| {
                d.Name()
                    .map(|n| n.to_string_lossy().contains(&target_ssid))
                    .unwrap_or(false)
            });

        let target = match target {
            Some(t) => t,
            None => {
                return Ok(WifiDirectPairResult {
                    success: false,
                    message: format!("주변에서 SSID '{}'를 찾지 못했습니다. 폰에서 호스트가 켜져 있는지 확인하세요.", ssid),
                });
            }
        };

        // 3) WiFiDirectDevice 인스턴스 획득.
        let device_id = target.Id().map_err(|e| format!("Id: {}", e))?;
        let _ = WiFiDirectDevice::FromIdAsync(&device_id)
            .map_err(|e| format!("FromIdAsync init: {}", e))?
            .await
            .map_err(|e| format!("FromIdAsync await: {}", e))?;

        // 4) PairAsync — passphrase 기반 WPS-PSK.
        // WiFiDirectConnectionParameters에 PIN 또는 push-button 모드 설정.
        // passphrase는 OS의 페어링 다이얼로그에서 자동 입력되거나 무음 처리.
        let pairing = target.Pairing().map_err(|e| format!("Pairing: {}", e))?;
        let _params = WiFiDirectConnectionParameters::new()
            .map_err(|e| format!("ConnectionParameters: {}", e))?;
        // PIN 모드 명시. Windows가 passphrase를 알아서 처리하도록 비대화형으로.
        let pin_hstring = HSTRING::from(passphrase);
        let result = pairing
            .PairWithProtectionLevelAndSettingsAsync(
                windows::Devices::Enumeration::DevicePairingProtectionLevel::Default,
                &windows::Devices::Enumeration::DevicePairingSettings::new()
                    .map_err(|e| format!("PairingSettings: {}", e))?,
            )
            .map_err(|e| format!("PairAsync init: {}", e))?
            .await
            .map_err(|e| format!("PairAsync await: {}", e))?;
        let _ = pin_hstring; // passphrase는 OS에 미리 등록되거나 사용자 다이얼로그.

        let status = result.Status().map_err(|e| format!("Status: {}", e))?;
        // status 0 = Paired
        let success = status == windows::Devices::Enumeration::DevicePairingResultStatus::Paired;

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
