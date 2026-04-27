# Windows 빌드·에러 보고 가이드

> 안드↔윈도우 Wi-Fi Direct 자동 페어링 (`wifi_direct.rs`) 검증용.
> Mac에서는 Windows 코드가 `cfg(target_os="windows")`로 제외돼 컴파일 불가.
> 따라서 Windows 실기기에서 빌드해서 에러 메시지를 받아야 다음 디버깅이 가능합니다.

---

## 0. 사전 체크

이 가이드는 **Windows 10/11**에서 처음 빌드하는 분 기준. 이미 환경이 갖춰져 있다면 §3 으로 바로.

필요한 것:
- Windows 10 (1809+) 또는 Windows 11
- 인터넷 연결 (의존성 다운로드용 ~500MB)
- 최소 5GB 디스크 여유
- 관리자 권한 (Build Tools 설치 시)

---

## 1. Windows 환경 준비 (1회만)

### 1.1 Rust 설치 (필수)

1. https://rustup.rs/ 접속
2. **`rustup-init.exe`** 다운로드 → 실행
3. 설치 옵션 묻는 화면 나오면 **`1) Proceed with installation (default)`** 선택 (Enter)
4. 끝나면 PowerShell **새 창**을 열어 확인:
   ```powershell
   rustc --version
   ```
   → `rustc 1.xx.x (xxxxxxxxx 2026-xx-xx)` 형태로 나오면 OK

### 1.2 Visual Studio Build Tools 설치 (Tauri 필수)

> Tauri는 Windows에서 **MSVC C++ 컴파일러**를 사용. WiFi Direct API도 Windows SDK가 필요.

1. https://visualstudio.microsoft.com/visual-cpp-build-tools/ 접속
2. **"Build Tools 다운로드"** 클릭
3. 인스톨러 실행 → 워크로드 화면에서 **"C++을 사용한 데스크톱 개발"** 체크
4. 우측 패널에서 다음 항목 체크 확인:
   - MSVC v143 (또는 최신)
   - Windows 11 SDK (또는 Windows 10 SDK)
5. **설치** 클릭 → 5~15분 소요 (네트워크 따라)

### 1.3 Git 설치 (이미 있으면 skip)

- https://git-scm.com/download/win
- 기본 옵션으로 설치

### 1.4 Node.js (선택 — `cargo check`만 할 거면 불필요)

- https://nodejs.org/ → **LTS** 버전 다운로드
- 설치 후 `node --version` 확인

> 여기까지가 1회 setup. 다음 빌드부터는 §3만 반복.

---

## 2. Repo 받기 (1회 또는 업데이트 시)

PowerShell 실행 (Win+X → "Windows PowerShell" 또는 "터미널"):

### 처음이면 — clone
```powershell
cd $HOME\Desktop
git clone https://github.com/SmileonLabs/Velo-for-Desktop.git
```

### 이미 받아뒀으면 — 최신화
```powershell
cd $HOME\Desktop\Velo-for-Desktop
git pull origin main
```

> 이미 받은 적 있다면 항상 `git pull origin main`으로 최신 코드 받은 뒤 빌드.

---

## 3. 빌드 + 에러 캡처 (매번)

### 3.1 빌드 명령

```powershell
cd $HOME\Desktop\Velo-for-Desktop\desktop-app\src-tauri
cargo check 2>&1 | Tee-Object -FilePath errors.txt
```

- **첫 실행 시 5~10분** (의존성 다운로드)
- 두 번째부터는 30초 ~ 1분
- 끝나면:
  - `errors.txt` 파일이 같은 폴더에 생성됨
  - 콘솔에도 동시에 표시 (빨간색 = 에러)

### 3.2 결과 해석

#### ✅ 성공
```
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 12.34s
```
이 문구가 **마지막 줄**에 있으면 빌드 성공. 보고할 에러 없음.

#### ❌ 실패
```
error[E0XXX]: ...
   --> src/wifi_direct.rs:NN:NN
   |
NN |     code line here
   |     ^^^^^^^^^ help: ...

error: could not compile `velo` (lib) due to N previous errors
```

이런 형태로 나옴. **빨간색 `error[E0XXX]:`** 블록을 보고해주시면 됩니다.

---

## 4. 에러 보고 방법

다음 셋 중 하나로 보내주시면 됩니다.

### 옵션 A — `errors.txt` 파일 통째로 (가장 간단·정확)

PowerShell에서 파일 위치 확인:
```powershell
notepad errors.txt
```
- 메모장으로 열림
- **전체 선택(Ctrl+A) → 복사(Ctrl+C)** → 텔레그램/대화창에 붙여넣기

### 옵션 B — 빨간색 부분만 복사

콘솔에서 마우스로 **`error[`** 부터 그 블록 끝까지 드래그 → 우클릭 → 복사 → 붙여넣기.

> 단점: 여러 에러가 길게 나오면 일부만 보낼 위험. 가능하면 옵션 A 추천.

### 옵션 C — 스크린샷

콘솔 창 캡처해서 이미지로 보내기.

> 단점: 텍스트 검색 안 되고 긴 에러는 잘릴 수 있음. 짧은 에러일 때만.

---

## 5. 보고 시 함께 알려주실 정보

같이 보내주시면 더 빠른 해결:

```
1. Windows 버전: (예) Windows 11 23H2
2. Rust 버전: rustc --version 결과
3. 빌드 명령: cargo check
4. 에러 발생 시점: (예) 첫 시도 / git pull 후 / 의존성 다운로드 중
```

PowerShell에서 정보 한 번에 얻기:
```powershell
"Windows: $([System.Environment]::OSVersion.Version)"
rustc --version
cargo --version
```

---

## 6. 흔한 사전 에러 + 자가 해결

빌드 전에 이게 막히면 Rust·Build Tools 자체 문제이므로 §1 다시 확인.

| 증상 | 원인 | 해결 |
|---|---|---|
| `cargo: 명령을 찾을 수 없습니다` | Rust 설치 후 PowerShell 재시작 안 함 | PowerShell **새 창** 열기 |
| `link.exe not found` 또는 `MSVC` 에러 | Visual Studio Build Tools 미설치 | §1.2 다시 |
| `failed to download crate` | 네트워크/방화벽 | VPN 끄고 다시 시도, 회사망 차단 시 핫스팟 |
| `Permission denied` | 폴더 권한 | 관리자 PowerShell로 재시도 |
| `error: linker not found` | C++ workload 누락 | VS Installer에서 "C++ build tools" 체크 추가 |

---

## 7. 다음 라운드

대표님이 에러 보고 → 제가 코드 수정 → main 푸시.
대표님은 다시 §2 → §3 반복.

빌드 성공 (`Finished` 라인 나옴) 까지 보통 **2~3 라운드** 예상.

---

## 8. 빌드 성공한 다음

```
Finished `dev` profile ...
```
나오면 알려주세요. 다음 단계는:
1. 실제 Windows 데스크탑 앱 실행: `npm run tauri dev` (Velo-for-Desktop\desktop-app 디렉토리)
2. 안드에서 "공유기 없이 연결" 켜고 SSID/비번 받기
3. 윈도우 헤더의 "Wi-Fi Direct" 버튼 → SSID/비번 입력 → 연결
4. 안드 화면에 데스크탑 자동 표시되는지 확인

---

**작성일**: 2026-04-27
**대상 기능**: Wi-Fi Direct 자동 페어링 (D2 windows-rs 바인딩 검증)
**관련 커밋**: `dc64be0` (D1) / `ea05073` (D2) / `a17d4af` (D5)
