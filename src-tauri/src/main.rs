mod server;
mod state;
mod tools;

use std::sync::Arc;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Manager, RunEvent,
};
use tauri_plugin_updater::UpdaterExt;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

const MENU_CHECK_FOR_UPDATES: &str = "check_for_updates";
const MENU_ABOUT: &str = "about";

fn show_dialog<R: tauri::Runtime>(app: &tauri::AppHandle<R>, title: &str, message: &str) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let Ok(title_json) = serde_json::to_string(title) else {
        return;
    };
    let Ok(msg_json) = serde_json::to_string(message) else {
        return;
    };

    // Injects style once, reuses for subsequent dialogs
    let _ = window.eval(&format!(
        r#"(function(t,m){{
            var old=document.getElementById('__fp_dialog');if(old)old.remove();
            if(!document.getElementById('__fp_ds')){{var s=document.createElement('style');s.id='__fp_ds';s.textContent='@keyframes __fp_fade{{from{{opacity:0}}to{{opacity:1}}}}@keyframes __fp_pop{{from{{opacity:0;transform:scale(.96) translateY(8px)}}to{{opacity:1;transform:scale(1) translateY(0)}}}}';document.head.appendChild(s)}}
            var o=document.createElement('div');o.id='__fp_dialog';
            o.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:99999;animation:__fp_fade .15s ease-out;font-family:-apple-system,BlinkMacSystemFont,Helvetica Neue,sans-serif;backdrop-filter:blur(4px)';
            o.innerHTML='<div style="background:rgba(30,30,30,0.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);color:#ececec;border-radius:14px;padding:28px 32px;min-width:320px;max-width:400px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,0.08);animation:__fp_pop .2s cubic-bezier(.16,1,.3,1)"><div style="font-size:14px;font-weight:600;margin-bottom:10px;color:#ececec"></div><div style="font-size:12px;white-space:pre-line;color:#999;line-height:1.6"></div><button style="margin-top:22px;padding:7px 28px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:rgba(255,255,255,.06);color:#ececec;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;transition:all .12s">OK</button></div>';
            var d=o.firstChild,ti=d.children[0],mi=d.children[1],b=d.children[2];
            ti.textContent=t;mi.textContent=m;
            b.onmouseenter=function(){{b.style.background='rgba(255,255,255,.12)'}};
            b.onmouseleave=function(){{b.style.background='rgba(255,255,255,.06)'}};
            var close=function(){{o.style.opacity='0';o.style.transition='opacity .15s';setTimeout(function(){{o.remove()}},150)}};
            b.onclick=close;o.onclick=function(e){{if(e.target===o)close()}};
            document.body.append(o);b.focus();
        }})({title},{msg})"#,
        title = title_json,
        msg = msg_json,
    ));
}

async fn run_update_check<R: tauri::Runtime>(app: tauri::AppHandle<R>) {
    let updater = match app.updater() {
        Ok(updater) => updater,
        Err(err) => {
            show_dialog(&app, "Error", &format!("Updater failed: {err}"));
            return;
        }
    };

    let update = match updater.check().await {
        Ok(Some(update)) => update,
        Ok(None) => {
            show_dialog(&app, "Update", "You are already using the latest version.");
            return;
        }
        Err(_) => {
            show_dialog(&app, "Update", "No updates available right now.");
            return;
        }
    };

    show_dialog(
        &app,
        "Update",
        &format!(
            "Update {} is available. Downloading and installing...",
            update.version
        ),
    );

    if let Err(err) = update
        .download_and_install(|_chunk_length, _content_length| {}, || {})
        .await
    {
        show_dialog(&app, "Error", &format!("Failed to install update: {err}"));
        return;
    }

    app.restart();
}

fn main() {
    let app_state = Arc::new(RwLock::new(state::load_state()));
    let ct = CancellationToken::new();

    let server_state = app_state.clone();
    let server_ct = ct.clone();

    let app = tauri::Builder::default()
        .setup(move |app| {
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            // Force dark theme on the main window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_theme(Some(tauri::Theme::Dark));

                // Disable WebKitGTK pinch-to-zoom gesture on Linux
                #[cfg(target_os = "linux")]
                {
                    let webview = window.as_ref();
                    let _ = webview.with_webview(|wv| {
                        use gtk::prelude::*;

                        let inner = wv.inner();
                        let widget: gtk::Widget = inner.clone().upcast();

                        // Kill WebKitGTK's default zoom gesture
                        unsafe {
                            if let Some(data) =
                                widget.data::<gtk::GestureZoom>("wk-view-zoom-gesture")
                            {
                                let ptr: *mut gobject_sys::GObject = data.as_ptr().cast();
                                gobject_sys::g_signal_handlers_destroy(ptr);
                            }
                        }

                        // Add our own pinch gesture that forwards to JS canvas zoom
                        let gesture = gtk::GestureZoom::new(&widget);
                        gesture.set_propagation_phase(gtk::PropagationPhase::Capture);
                        let prev_scale = std::rc::Rc::new(std::cell::Cell::new(1.0f64));
                        let wv_ref = inner.clone();
                        let ps1 = prev_scale.clone();
                        gesture.connect_scale_changed(move |_, scale| {
                            use webkit2gtk::WebViewExt;
                            let delta = scale - ps1.get();
                            ps1.set(scale);
                            let js = format!(
                                "window.__fpPinchZoom?.({})",
                                -delta * 200.0
                            );
                            wv_ref.run_javascript(&js, None::<&gio::Cancellable>, |_| {});
                        });
                        let ps2 = prev_scale.clone();
                        gesture.connect_end(move |_, _| {
                            ps2.set(1.0);
                        });
                        // Keep gesture alive by leaking — it's tied to app lifetime
                        std::mem::forget(gesture);
                    });
                }
            }

            let about =
                MenuItemBuilder::with_id(MENU_ABOUT, "About FlowPlan").build(app)?;
            let check_for_updates =
                MenuItemBuilder::with_id(MENU_CHECK_FOR_UPDATES, "Check for Updates...")
                    .build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").accelerator("CmdOrCtrl+Q").build(app)?;
            let app_submenu = SubmenuBuilder::new(app, "FlowPlan")
                .item(&about)
                .separator()
                .item(&check_for_updates)
                .separator()
                .item(&quit)
                .build()?;
            let menu = MenuBuilder::new(app).item(&app_submenu).build()?;
            app.set_menu(menu)?;
            app.on_menu_event(move |app, event| {
                if event.id() == MENU_ABOUT {
                    let version = app.package_info().version.to_string();
                    let year = chrono::Utc::now().format("%Y");
                    show_dialog(app, "About FlowPlan", &format!("v{version}\n\nA visual plan board for AI coding agents.\n\n© {year} Barış Özer. All rights reserved."));
                } else if event.id() == "quit" {
                    app.exit(0);
                } else if event.id() == MENU_CHECK_FOR_UPDATES {
                    let handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        run_update_check(handle).await;
                    });
                }
            });

            tauri::async_runtime::spawn(async move {
                if let Err(e) = server::run_server(server_state, server_ct).await {
                    eprintln!("[PVP] Server error: {}", e);
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    let shutdown_ct = ct.clone();
    app.run(move |_app_handle, event| {
        if let RunEvent::Exit = event {
            shutdown_ct.cancel();
        }
    });
}
