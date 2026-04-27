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

// MARK: - Windows 구현 (D2에서 windows-rs로 채울 예정)
#[cfg(target_os = "windows")]
mod windows_impl {
    use super::WifiDirectPairResult;

    pub async fn pair(ssid: &str, passphrase: &str) -> Result<WifiDirectPairResult, String> {
        // TODO(D2): Windows.Devices.WiFiDirect WiFiDirectAdvertisement 발견 →
        //           WiFiDirectDevice.PairAsync(passphrase) 호출.
        //           windows-rs 크레이트 + Windows SDK 필요.
        let _ = (ssid, passphrase);
        Ok(WifiDirectPairResult {
            success: false,
            message: "Wi-Fi Direct 자동 페어링 구현 진행 중 (D2)".to_string(),
        })
    }
}
