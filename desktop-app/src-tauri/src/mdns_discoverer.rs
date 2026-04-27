// 다른 Velo 기기 발견 — `_velo._tcp.local` 광고를 listening.
// mdns_advertiser는 자기 자신을 광고만 하고, 이 모듈이 상대(폰·다른 데스크탑) 광고를 듣는다.
//
// 데스크탑이 폰을 발견할 수 있어야 양방향 동기화 UX가 자연스러움.
// 자기 자신 광고는 own_device_id로 필터링.
// "같은 계정 디바이스만 표시" 같은 추가 필터링은 호출자(프론트)가 처리.

use mdns_sd::{ServiceDaemon, ServiceEvent};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredDevice {
    pub device_id: String,
    pub device_name: String,
    pub ip: String,
    pub port: u16,
    pub version: String,
}

/// 백그라운드 thread에서 mDNS 이벤트를 받아 cache 갱신. 메인 thread는 list()로 스냅샷 조회.
pub struct MdnsBrowserHandle {
    daemon: ServiceDaemon,
    cache: Arc<Mutex<HashMap<String, DiscoveredDevice>>>,
    /// fullname → device_id 매핑 — ServiceRemoved 이벤트 처리용 (TXT 필드 없이 fullname만 받음).
    fullname_index: Arc<Mutex<HashMap<String, String>>>,
}

impl MdnsBrowserHandle {
    /// 발견 시작. 자기 자신 device_id는 결과에서 자동 제외.
    pub fn start(own_device_id: String) -> Result<Self, String> {
        let daemon = ServiceDaemon::new().map_err(|e| format!("mdns daemon: {}", e))?;
        let receiver = daemon
            .browse("_velo._tcp.local.")
            .map_err(|e| format!("mdns browse: {}", e))?;

        let cache: Arc<Mutex<HashMap<String, DiscoveredDevice>>> =
            Arc::new(Mutex::new(HashMap::new()));
        let fullname_index: Arc<Mutex<HashMap<String, String>>> =
            Arc::new(Mutex::new(HashMap::new()));

        let cache_thread = cache.clone();
        let fullname_thread = fullname_index.clone();
        let own_id = own_device_id;

        thread::spawn(move || {
            while let Ok(event) = receiver.recv() {
                match event {
                    ServiceEvent::ServiceResolved(info) => {
                        let device_id = info
                            .get_property("device_id")
                            .map(|p| p.val_str().to_string())
                            .unwrap_or_default();
                        // 자기 자신 광고는 무시 — 자기 device_id가 들어옴.
                        if device_id.is_empty() || device_id == own_id {
                            continue;
                        }
                        let device_name = info
                            .get_property("device_name")
                            .map(|p| p.val_str().to_string())
                            .unwrap_or_else(|| info.get_fullname().to_string());
                        let version = info
                            .get_property("version")
                            .map(|p| p.val_str().to_string())
                            .unwrap_or_default();
                        // 첫 번째 IP만 사용 — IPv4 우선 정렬 후 가능. mdns-sd는 보통 IPv4 먼저 반환.
                        let ip = info
                            .get_addresses()
                            .iter()
                            .next()
                            .map(|a| a.to_string())
                            .unwrap_or_default();
                        let port = info.get_port();
                        let fullname = info.get_fullname().to_string();

                        let device = DiscoveredDevice {
                            device_id: device_id.clone(),
                            device_name,
                            ip,
                            port,
                            version,
                        };

                        if let Ok(mut c) = cache_thread.lock() {
                            c.insert(device_id.clone(), device);
                        }
                        if let Ok(mut f) = fullname_thread.lock() {
                            f.insert(fullname, device_id);
                        }
                    }
                    ServiceEvent::ServiceRemoved(_, fullname) => {
                        // ServiceRemoved의 fullname으로 매핑된 device_id 찾아 캐시에서 제거.
                        let removed_id = fullname_thread
                            .lock()
                            .ok()
                            .and_then(|mut f| f.remove(&fullname));
                        if let Some(id) = removed_id {
                            if let Ok(mut c) = cache_thread.lock() {
                                c.remove(&id);
                            }
                        }
                    }
                    _ => {
                        // SearchStarted/Stopped, ServiceFound (resolved 전), ResolveError 등은 무시.
                    }
                }
            }
        });

        Ok(Self {
            daemon,
            cache,
            fullname_index,
        })
    }

    /// 현재까지 발견된 디바이스 스냅샷. 자기 자신 이미 제외됨.
    pub fn list(&self) -> Vec<DiscoveredDevice> {
        self.cache
            .lock()
            .map(|c| c.values().cloned().collect())
            .unwrap_or_default()
    }

    /// 명시적 종료. 보통 앱 lifetime 끝까지 살아있어 호출 안 함.
    #[allow(dead_code)]
    pub fn shutdown(&self) {
        let _ = self.daemon.shutdown();
    }

    #[allow(dead_code)]
    pub fn fullname_count(&self) -> usize {
        self.fullname_index.lock().map(|f| f.len()).unwrap_or(0)
    }
}
