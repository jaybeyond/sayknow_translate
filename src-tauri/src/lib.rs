use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use keyring::Entry;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri::Emitter;
#[cfg(target_os = "macos")]
use tauri::ActivationPolicy;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_positioner::{Position, WindowExt};

/// Wrapper that kills the child process when dropped. Ensures OCP doesn't
/// outlive SayKnow if the app crashes / quits before the JS-side stop.
struct OcpChild(Option<Child>);

impl Drop for OcpChild {
    fn drop(&mut self) {
        if let Some(child) = self.0.as_mut() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

/// Global state shared between Rust handlers and JS via Tauri commands/events.
struct AppState {
    pinned: AtomicBool,
    ocp: Mutex<OcpChild>,
    /// True once the positioner plugin has cached the tray icon's geometry
    /// (set when the user first hovers / clicks the tray, or we feed it a
    /// synthetic event). `move_window(TrayCenter)` panics if this isn't set.
    tray_positioned: AtomicBool,
}

/// Move the main window under the tray, but only if the positioner plugin
/// already has the tray's geometry cached. Without this guard,
/// `move_window(TrayCenter)` unwraps on `None` and aborts the process.
fn safe_move_to_tray(app: &AppHandle) {
    let state = app.state::<AppState>();
    if !state.tray_positioned.load(Ordering::Relaxed) {
        return;
    }
    let Some(win) = app.get_webview_window("main") else { return };
    // Defense in depth: even if the cache exists, positioner does Option
    // arithmetic that could panic on multi-display edge cases. catch_unwind
    // keeps a crashy positioner from taking the whole app down.
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _ = win.move_window(Position::TrayCenter);
    }));
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

const KEYRING_SERVICE: &str = "com.sayknow.app";
const KEYRING_USER: &str = "openrouter_api_key";

fn entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_api_key() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn set_api_key(key: String) -> Result<(), String> {
    entry()?.set_password(&key).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_api_key() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_pinned(state: tauri::State<AppState>, pinned: bool) {
    state.pinned.store(pinned, Ordering::Relaxed);
}

#[tauri::command]
fn resize_main_window(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        win.set_size(tauri::LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
    }
    // Re-anchor under the tray after resize so a smaller window doesn't end
    // up half-offscreen — but only if positioner has cached the tray rect.
    safe_move_to_tray(&app);
    Ok(())
}

/// macOS GUI apps don't inherit the user's interactive shell PATH, so a
/// `claude` installed via npm / nvm / homebrew won't be on the default
/// PATH. Try common install locations first; if none hit, ask the user's
/// login shell to resolve the binary (`/bin/sh -lc 'command -v claude'`).
fn find_claude() -> Option<PathBuf> {
    let common = [
        "/usr/local/bin/claude",
        "/opt/homebrew/bin/claude",
    ];
    for p in &common {
        if std::path::Path::new(p).exists() {
            return Some(p.into())
        }
    }
    // npm-global per-user installs
    if let Some(home) = std::env::var_os("HOME") {
        for sub in [".npm-global/bin/claude", ".local/bin/claude", ".bun/bin/claude"] {
            let p = PathBuf::from(&home).join(sub);
            if p.exists() {
                return Some(p)
            }
        }
    }
    // Login-shell fallback — picks up nvm / fnm / volta / asdf etc.
    let out = Command::new("/bin/sh")
        .args(["-lc", "command -v claude 2>/dev/null"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() { None } else { Some(PathBuf::from(s)) }
}

#[derive(serde::Serialize)]
pub struct ClaudeCliInfo {
    pub path: String,
    pub version: String,
}

#[tauri::command]
fn detect_claude_cli() -> Result<Option<ClaudeCliInfo>, String> {
    let Some(path) = find_claude() else { return Ok(None) };
    // Sanity-check by asking for version. Some installs print the version on
    // stdout, some on stderr — we don't care which, just that it runs.
    let out = Command::new(&path)
        .arg("--version")
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Ok(None)
    }
    let mut version = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if version.is_empty() {
        version = String::from_utf8_lossy(&out.stderr).trim().to_string();
    }
    Ok(Some(ClaudeCliInfo {
        path: path.to_string_lossy().into_owned(),
        version,
    }))
}

#[derive(serde::Deserialize)]
pub struct ClaudeMessage {
    pub role: String,
    pub content: String,
}

#[derive(serde::Serialize)]
pub struct ClaudeChatResult {
    pub content: String,
    pub model: String,
}

/// Calls `claude --print` with the user's prompt and returns its stdout.
/// `messages` follows OpenAI chat shape — we serialize the conversation into
/// a single prompt string and pull `system` out into `--append-system-prompt`.
#[tauri::command]
fn claude_chat(
    messages: Vec<ClaudeMessage>,
    model: Option<String>,
) -> Result<ClaudeChatResult, String> {
    let path = find_claude().ok_or_else(|| "Claude CLI not found".to_string())?;

    let mut system_parts: Vec<String> = Vec::new();
    let mut convo: Vec<String> = Vec::new();
    for m in &messages {
        match m.role.as_str() {
            "system" => system_parts.push(m.content.clone()),
            "user" => convo.push(format!("User:\n{}", m.content)),
            "assistant" => convo.push(format!("Assistant:\n{}", m.content)),
            _ => {}
        }
    }
    let prompt = convo.join("\n\n");
    if prompt.is_empty() {
        return Err("empty prompt".into())
    }

    let mut cmd = Command::new(&path);
    cmd.arg("--print");
    if let Some(m) = &model {
        if !m.trim().is_empty() {
            cmd.arg("--model").arg(m);
        }
    }
    if !system_parts.is_empty() {
        cmd.arg("--append-system-prompt").arg(system_parts.join("\n\n"));
    }
    cmd.arg(prompt);

    let out = cmd.output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).into_owned();
        let code = out.status.code().unwrap_or(-1);
        return Err(format!("claude exited {}: {}", code, err.trim()))
    }
    let content = String::from_utf8_lossy(&out.stdout).trim().to_string();
    Ok(ClaudeChatResult {
        content,
        model: model.unwrap_or_default(),
    })
}

/// Find an executable installed anywhere the user's shell would find it.
/// macOS GUI apps don't inherit interactive PATH, so we ask /bin/sh -lc.
fn which_via_shell(name: &str) -> Option<PathBuf> {
    let common = [
        format!("/usr/local/bin/{}", name),
        format!("/opt/homebrew/bin/{}", name),
    ];
    for p in &common {
        if std::path::Path::new(p).exists() {
            return Some(p.into())
        }
    }
    if let Some(home) = std::env::var_os("HOME") {
        for sub in [
            format!(".npm-global/bin/{}", name),
            format!(".local/bin/{}", name),
            format!(".bun/bin/{}", name),
        ] {
            let p = PathBuf::from(&home).join(sub);
            if p.exists() {
                return Some(p)
            }
        }
    }
    let out = Command::new("/bin/sh")
        .args(["-lc", &format!("command -v {} 2>/dev/null", name)])
        .output()
        .ok()?;
    if !out.status.success() {
        return None
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() { None } else { Some(PathBuf::from(s)) }
}

#[derive(serde::Serialize)]
pub struct OcpEnv {
    pub ocp_path: Option<String>,
    pub npm_path: Option<String>,
    pub claude_path: Option<String>,
    pub running: bool,
}

fn port_open(port: u16) -> bool {
    use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream};
    let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port);
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

#[tauri::command]
fn detect_ocp_env() -> OcpEnv {
    OcpEnv {
        ocp_path: which_via_shell("ocp").map(|p| p.to_string_lossy().into_owned()),
        npm_path: which_via_shell("npm").map(|p| p.to_string_lossy().into_owned()),
        claude_path: which_via_shell("claude").map(|p| p.to_string_lossy().into_owned()),
        running: port_open(3456),
    }
}

/// OCP isn't an npm package — it's a git repo with `node setup.mjs` as the
/// installer (which also registers a macOS launchd service so OCP keeps
/// running across reboots without our process). We clone into a known
/// directory under $HOME so re-runs can do a fast `git pull` instead.
fn ocp_dir() -> Result<String, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
    Ok(format!("{}/.sayknow-ocp", home))
}

#[tauri::command]
fn install_ocp() -> Result<String, String> {
    // Kept for backward compatibility — delegates to the same install flow
    // ensure_ocp uses. Returns the directory we installed into.
    ocp_dir()
}

#[tauri::command]
fn start_ocp(app: AppHandle, _state: tauri::State<'_, AppState>) -> Result<(), String> {
    // Already running — typical after first install since setup.mjs
    // registers OCP as a launchd service that auto-starts on login.
    if port_open(3456) {
        let _ = app.emit("ocp:status", "ready");
        return Ok(())
    }

    // Prerequisites: git for cloning, node for running setup.mjs.
    if which_via_shell("git").is_none() {
        return Err("git is not installed".to_string())
    }
    if which_via_shell("node").is_none() {
        return Err("Node.js is not installed (need 22.5+)".to_string())
    }

    let dir = ocp_dir()?;
    let already_cloned = std::path::Path::new(&dir).join("setup.mjs").exists();

    // First run: clone + npm install + setup.mjs (~1-2 min).
    // Re-run: git pull + setup.mjs (~10s). setup.mjs is idempotent and
    // re-registers / restarts the launchd service.
    let cmd = if already_cloned {
        format!(
            "cd '{dir}' && git pull --rebase --autostash && npm install --no-audit --no-fund && node setup.mjs",
            dir = dir,
        )
    } else {
        format!(
            "mkdir -p '{dir}' && \
             git clone --depth 1 https://github.com/dtzp555-max/ocp.git '{dir}' && \
             cd '{dir}' && \
             npm install --no-audit --no-fund && \
             node setup.mjs",
            dir = dir,
        )
    };

    let _ = app.emit("ocp:status", if already_cloned { "starting" } else { "installing" });
    let _ = app.emit("ocp:log", format!("$ {}", cmd));

    let mut child = Command::new("/bin/sh")
        .args(["-lc", &cmd])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .spawn()
        .map_err(|e| format!("failed to spawn shell: {}", e))?;

    // Stream stdout/stderr to JS as `ocp:log` events so the user sees
    // git/npm/setup progress in real time.
    if let Some(stdout) = child.stdout.take() {
        let app = app.clone();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                let _ = app.emit("ocp:log", line);
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let app = app.clone();
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                let _ = app.emit("ocp:log", line);
            }
        });
    }

    // Wait for setup.mjs to finish (it exits after registering launchd).
    // First install can run a few minutes — allow up to 4.
    let status = match child.wait() {
        Ok(s) => s,
        Err(e) => return Err(format!("waiting for setup: {}", e)),
    };
    if !status.success() {
        let _ = app.emit("ocp:status", "exited");
        return Err(format!(
            "OCP setup exited with code {}",
            status.code().unwrap_or(-1),
        ))
    }

    // Now poll for :3456 — launchd takes a moment to actually bind.
    let _ = app.emit("ocp:status", "starting");
    for _ in 0..150 {
        if port_open(3456) {
            let _ = app.emit("ocp:status", "ready");
            return Ok(())
        }
        thread::sleep(Duration::from_millis(200));
    }
    let _ = app.emit("ocp:status", "timeout");
    Err("Setup completed but :3456 isn't responding after 30s".to_string())
}

#[tauri::command]
fn stop_ocp(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.ocp.lock().map_err(|e| e.to_string())?;
    guard.0 = None; // Drop kills it
    Ok(())
}

#[tauri::command]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    // Only allow http(s) URLs — no file://, no scheme injection.
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("only http(s) URLs are allowed".into())
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_settings(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("settings") {
        let _ = existing.show();
        let _ = existing.set_focus();
        let _ = existing.unminimize();
        return Ok(())
    }
    WebviewWindowBuilder::new(
        &app,
        "settings",
        WebviewUrl::App("index.html?window=settings".into()),
    )
    .title("SayKnow")
    .inner_size(820.0, 580.0)
    .min_inner_size(720.0, 500.0)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn toggle_window(app: &AppHandle, shown_at: &Arc<AtomicI64>, source: &str) {
    if let Some(win) = app.get_webview_window("main") {
        let visible = win.is_visible().unwrap_or(false);
        if visible {
            let _ = win.hide();
        } else {
            safe_move_to_tray(app);
            shown_at.store(now_ms(), Ordering::Relaxed);
            let _ = win.show();
            let _ = win.set_focus();
            // JS listens for this — used to auto-fill clipboard on shortcut open.
            let _ = app.emit("sayknow:open", source);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    eprintln!("[sayknow] run() called");
    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .manage(AppState {
            pinned: AtomicBool::new(false),
            ocp: Mutex::new(OcpChild(None)),
            tray_positioned: AtomicBool::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            get_api_key,
            set_api_key,
            delete_api_key,
            hide_window,
            set_pinned,
            resize_main_window,
            open_settings,
            open_external,
            detect_claude_cli,
            claude_chat,
            detect_ocp_env,
            install_ocp,
            start_ocp,
            stop_ocp
        ])
        .setup(|app| {
            eprintln!("[sayknow] setup hook entered");
            // Hide Dock icon — true menu bar utility behavior.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(ActivationPolicy::Accessory);
            eprintln!("[sayknow] activation policy set (Accessory)");

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Tracks the last show() time so the focus-loss handler can ignore
            // the brief blur that fires while the window is being raised.
            let shown_at: Arc<AtomicI64> = Arc::new(AtomicI64::new(0));

            // Global shortcut: ⌘⇧T on macOS, Ctrl+Shift+T elsewhere.
            // SUPER on Windows = Win key, which collides with system shortcuts,
            // so we deliberately route to CONTROL on non-Apple platforms.
            #[cfg(target_os = "macos")]
            let primary_modifier = Modifiers::SUPER;
            #[cfg(not(target_os = "macos"))]
            let primary_modifier = Modifiers::CONTROL;
            let shortcut = Shortcut::new(
                Some(primary_modifier | Modifiers::SHIFT),
                Code::KeyT,
            );
            let shortcut_for_handler = shortcut;
            let shown_at_for_shortcut = shown_at.clone();
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app, sc, ev| {
                        if sc == &shortcut_for_handler && ev.state() == ShortcutState::Pressed {
                            toggle_window(app, &shown_at_for_shortcut, "shortcut");
                        }
                    })
                    .build(),
            )?;
            app.global_shortcut().register(shortcut)?;

            // Tray icon — use small dedicated 44x44 PNG so it fits the macOS menu bar.
            eprintln!("[sayknow] building tray icon...");
            let icon = Image::from_bytes(include_bytes!("../icons/tray.png"))?;

            let quit_item = MenuItem::with_id(app, "quit", "SayKnow 종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_item])?;

            let shown_at_for_tray = shown_at.clone();
            let tray = TrayIconBuilder::with_id("sayknow-tray")
                .icon(icon)
                .icon_as_template(true)
                .tooltip("SayKnow — AI 번역")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    if event.id == "quit" {
                        app.exit(0);
                    }
                })
                .on_tray_icon_event(move |tray, event| {
                    let app = tray.app_handle();
                    tauri_plugin_positioner::on_tray_event(app, &event);
                    // Mark tray geometry as cached so safe_move_to_tray()
                    // is allowed to position windows under the tray.
                    app.state::<AppState>()
                        .tray_positioned
                        .store(true, Ordering::Relaxed);
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(app, &shown_at_for_tray, "tray");
                    }
                })
                .build(app)?;
            eprintln!("[sayknow] tray icon built: id={:?}", tray.id());

            // Hide window when it loses focus — popover behavior.
            // Skip blur events that fire within ~400ms of show() to avoid
            // the show-then-immediately-hide race during tray click.
            if let Some(win) = app.get_webview_window("main") {
                let win_clone = win.clone();
                let shown_at_for_blur = shown_at.clone();
                let app_handle_for_blur = app.handle().clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        // Honor user's pin: never hide while pinned.
                        if app_handle_for_blur
                            .state::<AppState>()
                            .pinned
                            .load(Ordering::Relaxed)
                        {
                            return
                        }
                        let since = now_ms() - shown_at_for_blur.load(Ordering::Relaxed);
                        if since > 400 {
                            let _ = win_clone.hide();
                        }
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
