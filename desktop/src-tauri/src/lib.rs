use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // IMPORTANT: deep-link MUST be registered before single-instance.
    // When a second instance is launched with a seer:// URL in argv, the
    // single-instance plugin (built with the `deep-link` feature) forwards
    // that URL to the deep-link plugin's onOpenUrl emitter — but only if
    // deep-link was initialized first.
    builder = builder.plugin(tauri_plugin_deep_link::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            let _ = app
                .get_webview_window("main")
                .and_then(|w| {
                    let _ = w.set_focus();
                    Some(())
                });
        }));
    }

    builder
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SEER desktop app");
}
