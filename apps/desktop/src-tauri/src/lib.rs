// Rust 셸은 OS 연동(창, 메뉴, 저장소)만 맡는다. 데이터 처리는 모두 TypeScript (설계서 §1 원칙 3)

#[cfg(target_os = "macos")]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init());

    #[cfg(target_os = "macos")]
    let builder = builder.on_window_event(|window, event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            // 창을 닫아도 Realtime과 알림 클릭을 받는 WebView는 살아 있어야 한다.
            api.prevent_close();
            if let Err(error) = window.hide() {
                eprintln!("Could not hide the Nodii window: {error}");
            }
        }
    });

    builder
        .build(tauri::generate_context!())
        .expect("error while building Nodii")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } = _event
            {
                if let Some(window) = _app.get_webview_window("main") {
                    if let Err(error) = window.show().and_then(|()| window.set_focus()) {
                        eprintln!("Could not reopen the Nodii window: {error}");
                    }
                }
            }
        });
}
