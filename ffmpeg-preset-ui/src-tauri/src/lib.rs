use tauri::{plugin::TauriPlugin, Builder, Manager, Wry};

mod parser;
use parser::commands::RunningTasks;

#[cfg(debug_assertions)]
fn prevent_default() -> TauriPlugin<Wry> {
    use tauri_plugin_prevent_default::Flags;

    tauri_plugin_prevent_default::Builder::new()
        .with_flags(Flags::all().difference(Flags::DEV_TOOLS | Flags::RELOAD))
        .build()
}

#[cfg(not(debug_assertions))]
fn prevent_default() -> TauriPlugin<Wry> {
    tauri_plugin_prevent_default::init()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(prevent_default())
        .plugin(tauri_plugin_shell::init())
        .manage(RunningTasks::default())
        .setup(move |app| {
            #[cfg(debug_assertions)]
            if let Some(webview) = app.get_webview_window("main") {
                webview.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            parser::commands::start_parse,
            parser::commands::terminate_parse
        ])
        .on_window_event(parser::utils::kill_tasks_on_window_close_requested)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
