fn main() {
    // 런타임에서 sidecar 바이너리 이름(`cloudflared-{triple}`)을 찾기 위해 필요.
    // cargo가 빌드 시점에 설정하는 TARGET 값을 컴파일러 환경변수로 노출.
    if let Ok(triple) = std::env::var("TARGET") {
        println!("cargo:rustc-env=TARGET_TRIPLE={}", triple);
    }
    tauri_build::build()
}
