// mDNS (Bonjour) 서비스 광고 — 폰이 같은 LAN에서 "_velo._tcp.local" 검색하면
// 이 데스크탑을 즉시 발견. IP가 DHCP로 바뀌어도 mDNS는 자동 갱신되므로 Supabase
// user_devices에 기록된 local_ip가 stale할 때의 안전망.
//
// TXT 레코드에 device_id와 device_name을 실어 폰이 "누구 기기"인지 판별 가능.
//
// 참고: iOS 14+는 Local Network 권한 요청이 필요 (Info.plist NSLocalNetworkUsageDescription +
// NSBonjourServices에 "_velo._tcp" 추가). 모바일 앱 작업 시 반영.

use mdns_sd::{ServiceDaemon, ServiceInfo};
use std::collections::HashMap;

const SERVICE_TYPE: &str = "_velo._tcp.local.";

pub struct MdnsHandle {
    _daemon: ServiceDaemon,
    service_name: String,
}

pub fn start(
    port: u16,
    local_ip: &str,
    device_id: &str,
    device_name: &str,
) -> Result<MdnsHandle, String> {
    let daemon = ServiceDaemon::new().map_err(|e| format!("mdns daemon 생성 실패: {}", e))?;

    // 인스턴스 이름 — 같은 LAN에 여러 Velo 데스크탑 있어도 기기명으로 구분.
    // mDNS 레이블에 허용되는 문자만 남기기 (공백은 허용됨, 한글/이모지도 기술적으론 가능).
    let instance_name = sanitize_instance_name(device_name);
    let host_name = format!("{}.local.", device_id);

    let mut txt_records = HashMap::new();
    txt_records.insert("device_id".to_string(), device_id.to_string());
    txt_records.insert("device_name".to_string(), device_name.to_string());
    txt_records.insert("version".to_string(), env!("CARGO_PKG_VERSION").to_string());

    let service_info = ServiceInfo::new(
        SERVICE_TYPE,
        &instance_name,
        &host_name,
        local_ip,
        port,
        Some(txt_records),
    )
    .map_err(|e| format!("ServiceInfo 생성 실패: {}", e))?;

    daemon
        .register(service_info)
        .map_err(|e| format!("mdns 등록 실패: {}", e))?;

    Ok(MdnsHandle {
        _daemon: daemon,
        service_name: format!("{}.{}", instance_name, SERVICE_TYPE),
    })
}

impl MdnsHandle {
    pub fn full_name(&self) -> &str {
        &self.service_name
    }
}

fn sanitize_instance_name(name: &str) -> String {
    // mDNS 인스턴스 레이블은 63 바이트 제한. UTF-8 경계에서 안전하게 자름.
    let filtered: String = name.chars().filter(|c| *c != '.').collect();
    if filtered.as_bytes().len() <= 63 {
        return filtered;
    }
    let mut out = String::new();
    for ch in filtered.chars() {
        if out.as_bytes().len() + ch.len_utf8() > 63 {
            break;
        }
        out.push(ch);
    }
    out
}
