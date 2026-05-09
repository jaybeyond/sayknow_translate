<div align="center">

# SayKnow

**Menu bar AI translator for macOS — translates as you type.**

`say` + `know` — speak it, understand it.

[한국어](README.md) · **English** · [日本語](README.ja.md) · [中文](README.zh.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Tiếng Việt](README.vi.md)

[![macOS](https://img.shields.io/badge/macOS-11.0%2B-black?logo=apple)](https://www.apple.com/macos/)
[![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=black)](https://tauri.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

SayKnow lives in your **macOS menu bar**. One shortcut opens a small popover; stop typing for a moment and the translation appears. No more switching tabs to a translator and pasting back and forth.

It's **OpenRouter BYOK (Bring Your Own Key)** — a single key gives you access to **all 360+ models** OpenRouter supports (GPT-4o, Claude, Gemini, Llama, ...).

## Features

- ⚡ **Auto translate** — fires 1.5s after you stop typing
- ⌨️ **Manual mode** — only on `⌘⏎` or button press (saves tokens)
- 🪄 **Refine** — polite / casual / shorter / business / literal presets + custom prompt
- 🌐 **OpenRouter BYOK** — searchable combobox over 360+ models
- 🔁 **Fallback model** — OpenRouter retries server-side if the primary fails
- ⏹ **Stop** — abort an in-flight call when the model is slow
- 📋 **Clipboard auto-fill** — copy text anywhere → `⌘⇧T` → it lands in the input
- 🕘 **History** — searchable, pin entries to keep them forever
- 📌 **Pin window** — disable auto-hide when you want it open
- 📚 **Glossary** — keep company names, jargon, and proper nouns consistent
- ✏️ **Custom system prompt** — edit the translate / refine prompts directly
- 💰 **Usage tracking** — daily / monthly tokens and cost (USD)
- 🌓 **Light / dark / system** — auto-follows OS theme
- 🌍 **8 UI languages** — auto-detected from system locale
- 🔄 **36 translation languages** — across Asia, Europe, the Middle East, and Africa
- 🔒 **macOS Keychain** — your API key is stored AES-256 encrypted, never in plaintext

## System requirements

- macOS 11.0 (Big Sur) or later
- Apple Silicon (aarch64) — Intel via source build
- An OpenRouter API key — get one at [openrouter.ai/keys](https://openrouter.ai/keys)

## Install

### Option 1 — prebuilt DMG (recommended)

1. Download `SayKnow_x.x.x_aarch64.dmg` from [Releases](https://github.com/jaybeyond/sayknow_translate/releases).
2. Open the DMG and drag `SayKnow.app` into `/Applications`.
3. The build is unsigned, so Gatekeeper will block it on first launch:
   ```bash
   xattr -dr com.apple.quarantine /Applications/SayKnow.app
   ```
   Or right-click the app in Finder → **Open** → **Open** again.

### Option 2 — build from source

```bash
git clone https://github.com/jaybeyond/sayknow_translate.git
cd sayknow_translate
pnpm install
pnpm tauri build
# output: src-tauri/target/release/bundle/dmg/SayKnow_x.x.x_aarch64.dmg
```

## Usage

### First run

1. A small icon appears in the menu bar (next to the clock / Wi-Fi). The app is **not in the Dock** by design.
2. Click the tray icon → enter your OpenRouter API key → **Connect & start**.
3. The key is saved into **macOS Keychain** automatically — you won't be asked again.

### Daily flow

1. Click the tray icon or press `⌘⇧T` to open the popover.
2. Pick source / target language (or leave source on **Auto-detect**).
3. Type. After ~1.5s of inactivity, the translation appears below.
4. Click 📋 to copy.

### Refine

Tweak the tone or style after translation:
- Presets: **Polite / Casual / Shorter / Business / Literal**
- ✨ **Custom prompt** — anything you want, e.g. *"warmer tone"*

### Shortcuts

| Shortcut | Action |
|---|---|
| `⌘⇧T` | Toggle the popover (global) |
| `⌘⏎` | Translate immediately (manual mode) |

### Settings (separate window)

Click ⚙️ in the popover → **Settings** opens a full window with a sidebar:
- **General** — auto/manual mode, clipboard auto-fill, pin, theme, app language
- **Connection** — primary model, fallback model, sign out
- **Glossary** — term pairs ("backend team" → "Backend Team")
- **System prompt** — edit translate / refine prompts (variables: `{from}`, `{to}`, `{glossary}`)
- **Usage** — daily / monthly tokens and cost
- **About** — version, GitHub, OpenRouter

### Clipboard auto-fill

In **Settings → General**, enable "Auto-fill clipboard on ⌘⇧T". Then:
1. Select text in any app → ⌘C
2. ⌘⇧T → SayKnow opens with that text already in the input
3. In auto mode, it translates 1.5s later

## Security

Your OpenRouter key is a **billable credential**, so SayKnow never stores it in plaintext.

- macOS **Keychain** (service: `com.sayknow.app`, key: `openrouter_api_key`)
- AES-256 encrypted, derived from your macOS login password
- Other apps that try to read the key will trigger a system **Allow / Deny** prompt
- Protects against disk theft, backup leaks, and unauthorized access by other apps

## Development

```bash
# Prerequisites
node -v   # v20+
pnpm -v   # v9+
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
# Xcode CLT
xcode-select --install
```

```bash
pnpm install
pnpm tauri dev      # dev server + window with HMR
pnpm tauri build    # production .app + .dmg
```

## Tech stack

| Area | Tech |
|---|---|
| Framework | Tauri 2 + Vite 8 + React 19 |
| Languages | TypeScript (strict) + Rust |
| Styling | Tailwind v4 + shadcn/ui |
| Icons | Lucide React |
| Storage | localStorage + macOS Keychain (`keyring` crate) |
| Tauri plugins | `positioner`, `global-shortcut`, `clipboard-manager`, `opener`, `log` |
| External API | OpenRouter (`/chat/completions`, `/models`, `/auth/key`) |

## Roadmap

- [ ] System-wide text selection → hotkey → instant translate
- [ ] Favorite phrases / pins
- [ ] Launch at login
- [ ] Windows support
- [ ] Apple code-signing + notarization
- [ ] OCR (screenshot region translate)
- [ ] Local LLM adapters (Ollama, LM Studio)
- [ ] Model recommendation / side-by-side compare

## Contributing

PRs welcome. For larger changes, please open an issue first to discuss.

## License

[MIT](LICENSE)
