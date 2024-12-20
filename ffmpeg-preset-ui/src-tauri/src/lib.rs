use std::sync::{Arc, Mutex};
use tauri::{async_runtime, ipc::Channel, AppHandle, Builder, Manager, State, WindowEvent};
use tauri_plugin_shell::{ShellExt, process::CommandEvent};

mod parser;
use parser::{ParseOptions, ParseCommand, ParseEvent};

pub mod utils;
use utils::generate_uuid;

pub struct ParseTask {
    id: String,
    pid: u32,
    command: ParseCommand,
}

pub type RunningTasks = Arc<Mutex<Vec<ParseTask>>>;

#[tauri::command(rename_all = "snake_case")]
async fn start_parse(
    app_handle: AppHandle,
    running_tasks_state: State<'_, RunningTasks>,
    options: ParseOptions,
    channel: Channel<ParseEvent<'_>>,
) -> Result<(), String> {
    let id = generate_uuid();

    let parse_command = ParseCommand::build(options);

    let shell = app_handle.shell();
    let command = shell.command(&parse_command.command).args([
        "--login",
        "-c",
        &parse_command.args.join(" "),
    ]);

    let (mut rx, child) = command.spawn().map_err(|e| e.to_string())?;

    let pid = child.pid();
    {
        let mut running_tasks = running_tasks_state.lock().unwrap();
        running_tasks.push(ParseTask {
            id: id.clone(),
            pid,
            command: parse_command,
        });
    }

    channel
        .send(ParseEvent::Started { id: &id })
        .map_err(|e| e.to_string())?;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                channel
                    .send(ParseEvent::Progress {
                        id: &id,
                        r#type: "stdout",
                        content: &String::from_utf8_lossy(&line),
                    })
                    .unwrap();
            }
            CommandEvent::Stderr(line) => {
                let line_str = String::from_utf8_lossy(&line);
                channel
                    .send(ParseEvent::Progress {
                        id: &id,
                        r#type: "stderr",
                        content: &line_str,
                    })
                    .unwrap();
            }
            CommandEvent::Terminated(payload) => {
                {
                    let mut running_tasks = running_tasks_state.lock().unwrap();
                    running_tasks.retain(|x| x.id != id.clone());
                }
                channel
                    .send(ParseEvent::Finished {
                        id: &id,
                        success: matches!(payload.code, Some(0)),
                    })
                    .unwrap();
            }
            _ => {}
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(RunningTasks::default())
        .setup(move |app| {
            #[cfg(debug_assertions)]
            if let Some(webview) = app.get_webview_window("main") {
                webview.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![start_parse])
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                let running_tasks_state = window.state::<RunningTasks>();
                match running_tasks_state.inner().lock() {
                    Ok(running_tasks) => {
                        if !running_tasks.is_empty() {
                            let window_ = window.clone();
                            let result = async_runtime::block_on(async move {
                                utils::kill_tasks(window_, running_tasks).await
                            });
                            if !result {
                                api.prevent_close();
                            }
                        }
                    }
                    Err(_) => {
                        api.prevent_close();
                    }
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
