<div align="center">

# SayKnow

**타이핑하면 바로 번역되는 macOS 메뉴바 AI 번역기**

`say` (말하다) + `know` (알다) — 말하면 바로 이해되는 컨셉.

[![macOS](https://img.shields.io/badge/macOS-11.0%2B-black?logo=apple)](https://www.apple.com/macos/)
[![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=black)](https://tauri.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 개요

SayKnow는 **macOS 메뉴바에 상주**하는 AI 번역기입니다. 단축키 한 번으로 팝업이 뜨고, 타이핑이 멈추면 자동으로 번역해 줍니다. 번역기 사이트를 새 탭으로 띄우고 복사·붙여넣기를 반복하던 작업을 한 화면에서 끊김 없이 처리합니다.

**OpenRouter BYOK (Bring Your Own Key)** 구조로 GPT-4o, Claude, Gemini, Llama 등 OpenRouter가 지원하는 **모든 모델**(현재 360+종)을 키 하나로 사용할 수 있습니다.

## 주요 기능

- ⚡ **자동 번역** — 타이핑이 멈추면 1.5초 후 자동 호출 (디바운스)
- ⌨️ **수동 번역** — `⌘⏎` 또는 번역 버튼 누를 때만 호출 (비용 절약 모드)
- 🪄 **수정 번역 (Refine)** — 정중히·캐주얼·짧게·비즈니스·직역 프리셋 + 자유 프롬프트
- 🌐 **OpenRouter BYOK** — 360+ 모델 검색 가능한 콤보박스 (이름, ID, 가격으로 필터)
- 🔁 **폴백 모델** — 기본 모델 실패 시 OpenRouter가 서버 사이드에서 자동 재시도
- ⏹ **정지** — 응답 느릴 때 진행 중 호출 즉시 취소
- 🕘 **번역 기록** — 최근 50개 보관, 클릭으로 복원
- 🌓 **다크/라이트/시스템** 자동 추종 + 수동 토글
- 🔒 **macOS Keychain** — API 키 평문 저장 금지, OS 키체인에 AES-256 암호화
- 🌍 **9개 언어** 지원 (한국어, 영어, 일본어, 중국어, 스페인어, 프랑스어, 독일어, 베트남어 + 자동 감지)

## 스크린샷

> 추후 추가 예정

## 시스템 요구사항

- macOS 11.0 (Big Sur) 이상
- Apple Silicon (aarch64) — Intel은 직접 빌드 시 가능
- OpenRouter API 키 — [openrouter.ai/keys](https://openrouter.ai/keys) 에서 발급

## 설치

### 방법 1 — 빌드 결과물 사용 (권장)

1. [Releases](https://github.com/jaybeyond/sayknow/releases) 페이지에서 최신 `SayKnow_x.x.x_aarch64.dmg` 다운로드
2. DMG를 열고 SayKnow.app을 `/Applications`로 드래그
3. 첫 실행 시 macOS Gatekeeper가 차단하면 — 코드사이닝이 안 된 빌드라서 발생합니다:

   ```bash
   xattr -dr com.apple.quarantine /Applications/SayKnow.app
   ```

   또는 Finder에서 SayKnow.app **우클릭 → 열기** → "열기" 한 번 더.

### 방법 2 — 소스에서 직접 빌드

[개발 환경](#개발-환경) 섹션 참고.

## 사용법

### 첫 실행

1. SayKnow를 실행하면 macOS **메뉴 바 우측**(시계·와이파이 옆)에 작은 아이콘이 등장합니다. Dock에는 표시되지 않습니다.
2. 트레이 아이콘 **클릭** → 팝업 등장 → OpenRouter API 키 입력 → "연결하고 시작"
3. 키는 **macOS Keychain**에 자동 저장됩니다 — 다음 실행부터는 묻지 않음

### 일반 사용 (자동 번역)

1. 트레이 아이콘 클릭 또는 `⌘⇧T` → 팝업 열림
2. 상단에서 원본/대상 언어 선택 (또는 자동 감지)
3. 입력창에 텍스트 입력
4. 타이핑 멈추고 **1.5초** → 자동 번역 결과
5. `📋` 아이콘으로 복사

### 수정 번역 (Refine)

번역 결과 위에서 톤·스타일 다듬기:

- **정중히 / 캐주얼 / 짧게 / 비즈니스 / 직역** 프리셋
- ✨ **직접 지시** — 자유 프롬프트 (예: "좀 더 다정한 어조로")

### 단축키

| 단축키 | 동작 |
|---|---|
| `⌘⇧T` | 팝업 열기/닫기 (글로벌) |
| `⌘⏎` | 수동 모드에서 즉시 번역 |

### 자동 / 수동 모드 전환

- 톱니 ⚙️ → "번역 모드" → **자동 (1.5s)** / **수동 (⌘⏎)** 토글
- 수동 모드는 비용·요청 수를 줄이고 싶을 때

### 폴백 모델

기본 모델이 rate limit이나 다운에 걸렸을 때 자동 우회:

- ⚙️ → "폴백 모델 (선택)" 콤보박스에서 모델 지정
- OpenRouter가 요청 단계에서 `[기본, 폴백]` 순으로 자동 라우팅 (클라이언트는 한 번만 호출)
- 응답에서 실제 사용된 모델은 **번역 기록**에 표시됨

### 번역 기록

- 헤더 🕘 아이콘 → 최근 번역 50개
- 항목 클릭 → 입력+결과창 복원 (언어 페어도 자동 복원)
- 항목별 X로 삭제, "전체 삭제"로 비우기

## 보안

OpenRouter API 키는 **돈이 나가는 자격증명**이라 평문으로 저장하지 않습니다.

- macOS: **Keychain** (`com.sayknow.app` / `openrouter_api_key`)
- 키체인은 macOS 로그인 비밀번호로 파생된 키로 AES-256 암호화
- 다른 앱이 읽으려 하면 OS가 사용자에게 "허용/거부" 프롬프트 표시
- 디스크 도난, 백업 유출, 다른 앱 무단 접근으로부터 보호

자세한 위협 모델은 [PRD §3.4.5](demand/PRD_AI_번역앱.md#345-api-키-보안) 참고.

## 개발 환경

### 필수 도구

```bash
# Node 20+ (Vite 8 기준), pnpm 권장
node -v   # v20+
pnpm -v   # 9+

# Rust (Tauri 빌드용)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"
rustc --version  # 1.77.2+

# Xcode Command Line Tools (macOS)
xcode-select --install

# 아이콘 생성용 (선택)
brew install librsvg
```

### 개발 서버

```bash
pnpm install
pnpm tauri dev
```

`pnpm tauri dev`는 Vite dev 서버(포트 5173)를 띄우고 Tauri 윈도우를 그 위에서 엽니다. HMR이 동작하므로 React 코드 수정 시 즉시 반영.

브라우저 단독 실행도 가능 (메뉴바·트레이·키체인 기능은 비활성화):

```bash
pnpm dev
# → http://localhost:5173
```

### 프로덕션 빌드

```bash
pnpm tauri build
# → src-tauri/target/release/bundle/macos/SayKnow.app
# → src-tauri/target/release/bundle/dmg/SayKnow_x.x.x_aarch64.dmg
```

### 아이콘 갱신

`/tmp/sayknow-app.svg`, `/tmp/sayknow-tray.svg`를 수정한 뒤:

```bash
# librsvg + sips + iconutil로 모든 사이즈 + .icns 재생성
# (자세한 명령은 커밋 히스토리 참고)
```

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프레임워크 | Tauri 2 + Vite 8 + React 19 |
| 언어 | TypeScript (strict) + Rust |
| 스타일 | Tailwind v4 + shadcn/ui (new-york style) |
| 아이콘 | Lucide React |
| 상태/저장 | localStorage (설정·기록·캐시) + macOS Keychain (`keyring` crate) |
| Tauri 플러그인 | `tauri-plugin-positioner`, `tauri-plugin-global-shortcut`, `tauri-plugin-log` |
| 외부 API | OpenRouter (`/api/v1/chat/completions`, `/api/v1/models`, `/api/v1/auth/key`) |

### 디렉토리 구조

```
src/
├── App.tsx                    # 루트, 테마/세팅 부트스트랩 + 등장 모션
├── components/
│   ├── LoginPanel.tsx         # OpenRouter 키 입력 + 기능 카드
│   ├── TranslatePanel.tsx     # 메인 번역 화면
│   ├── ModelPicker.tsx        # 360+ 모델 검색 콤보박스
│   ├── HistoryMenu.tsx        # 번역 기록 팝오버
│   └── ui/                    # shadcn 컴포넌트
├── hooks/
│   ├── useSettings.ts         # 설정 (모델, 폴백, 언어, 자동/수동) + Keychain 동기화
│   ├── useTheme.ts            # 시스템/라이트/다크 + prefers-color-scheme 추종
│   ├── useDebounce.ts         # 1.5초 디바운스
│   ├── useModels.ts           # OpenRouter 모델 목록 fetch + 24h 캐시
│   └── useHistory.ts          # 번역 기록 (최근 50개)
└── lib/
    ├── openrouter.ts          # OpenRouter 어댑터, 프롬프트 빌더, 폴백 라우팅
    ├── secrets.ts             # Tauri Keychain ↔ localStorage 분기
    ├── storage.ts             # localStorage 헬퍼
    ├── history.ts             # 기록 저장소
    ├── runtime.ts             # Tauri 런타임 감지
    └── utils.ts               # cn() 등

src-tauri/
├── src/
│   ├── lib.rs                 # 트레이 + 글로벌 단축키 + 키체인 명령어 + 윈도우 토글
│   └── main.rs
├── Cargo.toml
├── tauri.conf.json            # 윈도우 설정 (480×580, 투명, 데코 없음, Accessory)
└── icons/                     # 트레이 + 앱 아이콘
```

## 로드맵

PRD에서 향후 작업으로 명시된 항목들:

- [ ] **즐겨찾는 표현** 저장
- [ ] **시스템 시작 시 자동 실행** 옵션
- [ ] **Windows 지원** (`tauri-plugin-positioner`는 Windows 트레이도 지원, `keyring` 크레이트는 Credential Manager로 자동 라우팅)
- [ ] **Apple 코드사이닝 + 노터라이즈** (xattr 단계 제거)
- [ ] **시스템 전역 텍스트 선택 → 단축키 → 즉시 번역** (접근성 권한)
- [ ] **OCR** (스크린샷 영역 번역)
- [ ] **음성 입력**
- [ ] **글로서리 (Glossary)** — 자주 쓰는 용어 일관 번역
- [ ] **로컬 LLM 어댑터** (Ollama / LM Studio 직접 연결)
- [ ] **토큰 사용량 / 비용 추적**

## 기여

PR 환영합니다. 큰 변경은 이슈 먼저 열어 논의해 주세요.

```bash
git clone https://github.com/jaybeyond/sayknow.git
cd sayknow
pnpm install
pnpm tauri dev
```

## 라이선스

[MIT](LICENSE)

## 참고

- [PRD (한국어)](demand/PRD_AI_번역앱.md) — 제품 요구사항 문서
- [Tauri 2 공식 문서](https://tauri.app/v2/)
- [shadcn/ui](https://ui.shadcn.com/)
- [OpenRouter](https://openrouter.ai/docs)
