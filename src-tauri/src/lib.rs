use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

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

/// Global state shared between Rust handlers and JS via Tauri commands/events.
struct AppState {
    pinned: AtomicBool,
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
            let _ = win.move_window(Position::TrayCenter);
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
        .manage(AppState {
            pinned: AtomicBool::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            get_api_key,
            set_api_key,
            delete_api_key,
            hide_window,
            set_pinned,
            open_settings,
            open_external
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
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(tray.app_handle(), &shown_at_for_tray, "tray");
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
