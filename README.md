# Velo

[![Project License](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)](https://github.com/SmileonLabs/Velo)

**Velo** is the smartest desktop video optimizer. Keep the visual quality you love while shedding the GBs you don't. Using the next-gen **SVT-AV1** and **VP9** engines, it provides visual parity with the original while reducing size by up to 80%. Everything happens 100% locally on your computer—private, secure, and lightning-fast.

---

## 🚀 Key Features (v1.0.0 Release)

- **Subjective VQ Magic**: Not just mathematical compression, but human-vision-centric optimization. It focuses quality where eyes notice most, reducing size without perceived loss.
- **3 Golden Presets**: Optimized for real-world usage—**Best Quality** (Archival), **Balanced** (SNS/Web), and **Smallest Size** (Mobile sharing).
- **10-bit HDR Preservation**: Keeps the vivid colors of iPhone/Samsung HDR recordings without the "washout" effect common in other tools.
- **Smart Parallel Processing**: Harnesses your CPU power to compress multiple videos simultaneously.
- **Privacy-First (100% Offline)**: Videos never leave your device. Complete offline processing with optional Metadata/GPS cleaning to protect your privacy.
- **Modern Desktop UI**: Built with Tauri for a lightweight, premium experience with smooth micro-interactions.

### Latest Updates (2026-02-24)

- **Image Compression Mode Added**: Added a new `Image Compression` mode with format options `JPG / PNG / WEBP` (default: JPG), quality control, and aspect-ratio-safe output.
- **Mode-Based File Filtering**: File picker and drag & drop now filter by current mode (`video` or `image`) to prevent unsupported files from entering the queue.
- **License UX Improved**: Added in-app **My License** modal and connected **PC Move** action to the mypage transfer flow.
- **Free Plan Quota Split**: Daily free limits are now separated by media type: `video 3/day`, `image 20/day`.
- **Update Notice Banner**: Added lightweight in-app update notice using `web/public/desktop-version.json` and R2 installer link.

---

## 🛠 Tech Stack

- **Core Engine**: FFmpeg (SVT-AV1 / VP9)
- **Framework**: [Tauri v2](https://tauri.app/) (Rust + React)
- **Frontend**: React + TypeScript + Vite
- **Styling**: Vanilla CSS (Premium interactions)
- **Infrastructure**: Supabase (Auth/DB) + Cloudflare R2 (Releases)

---

## ⚖️ License & Legal

This project is licensed under the **GNU General Public License v3.0**.

- **GPL v3**: If you modify or distribute this software, you must keep it open-source under the same GPL v3 license.
- **Disclaimer**: This software is provided "AS IS". Smileon Labs is not responsible for any data loss. Always backup your important videos.

---

## 📦 Installation & Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/)
- FFmpeg (Configured as Sidecar)

### Development
```bash
cd desktop-app
npm install
npm run tauri dev
```

---

## 🇰🇷 한국어 요약 (Korean Summary)

**Velo**는 "보이는 화질 그대로, 용량만 줄이는" 스마트한 데스크탑 동영상 압축 툴입니다.

### 주요 기능
- **인지 화질 최적화 (Subjective VQ)**: 사람 눈에 민감한 부분을 파악해 원본과 육안상 차이 없는 결과물을 만듭니다.
- **3대 황금 프리셋**: [최고화질 / 밸런스 / 용량우선] 버튼 하나로 상황에 맞는 최적의 압축을 수행합니다.
- **10-bit HDR 보존**: 아이폰 고화질 영상의 쨍한 색감을 물빠짐 없이 그대로 유지합니다.
- **100% 오프라인**: 영상은 절대 내 PC를 떠나지 않으며, 위치정보(GPS) 삭제 기능으로 개인정보를 보호합니다.

Copyright © 2026 Smileon Labs. All Rights Reserved.
