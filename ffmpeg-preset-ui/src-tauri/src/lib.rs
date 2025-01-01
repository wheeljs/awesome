use std::sync::Mutex;
use serde::Deserialize;
use tauri::{
    async_runtime,
    ipc::Channel,
    window::{ProgressBarState, ProgressBarStatus},
    AppHandle, Builder, Manager, State, UserAttentionType, WebviewWindow, WindowEvent,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_shell::{ShellExt, process::CommandEvent};

mod parser;
use parser::{ParseOptions, ParseCommand, ParseEvent};
use parser::parse::{try_duration_line, try_percent_line};

pub mod utils;
use utils::generate_uuid;

pub struct ParseTask {
    id: String,
    pid: u32,
    command: ParseCommand,
    duration: u64,
    percent: u8,
}

pub type RunningTasks = Mutex<Vec<ParseTask>>;

#[tauri::command]
fn terminate_parse(
    app_handle: AppHandle,
    running_tasks_state: State<'_, RunningTasks>,
    task_id: &str,
) -> Result<bool, String> {
    async_runtime::block_on(async move {
        if let Ok(running_tasks) = running_tasks_state.lock() {
            let task_to_kill: Vec<String> = running_tasks
                .iter()
                .filter(|x| x.id == task_id)
                .map(|task| task.pid.to_string())
                .collect();
            if !task_to_kill.is_empty() {
                return Ok(utils::kill_tasks(app_handle.shell(), task_to_kill).await);
            }
        }

        Ok(false)
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskOptions {
    need_std_output: Option<bool>,
}

#[tauri::command]
async fn start_parse(
    app_handle: AppHandle,
    webview_window: WebviewWindow,
    running_tasks_state: State<'_, RunningTasks>,
    options: ParseOptions,
    channel: Channel<ParseEvent<'_>>,
    task_options: TaskOptions,
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
            duration: 0,
            percent: 0,
        });
    }

    channel
        .send(ParseEvent::Started { id: &id })
        .map_err(|e| e.to_string())?;

    while let Some(event) = rx.recv().await {
        let need_std_output = task_options.need_std_output.unwrap_or(false);

        let _ = webview_window.set_progress_bar(ProgressBarState {
            status: Some(ProgressBarStatus::Normal),
            progress: Some(0),
        });
        match event {
            CommandEvent::Stdout(line) => {
                if need_std_output {
                    channel
                        .send(ParseEvent::StdOutput {
                            id: &id,
                            r#type: "stdout",
                            content: &String::from_utf8_lossy(&line),
                        })
                        .unwrap();
                }
            }
            CommandEvent::Stderr(line) => {
                let line_str = String::from_utf8_lossy(&line);
                if let Some(total_duration) = try_duration_line(&line_str) {
                    {
                        let mut running_tasks = running_tasks_state.lock().unwrap();
                        if let Some(task) = running_tasks.iter_mut().find(|t| t.id == id) {
                            task.duration = total_duration;
                        }
                    }
                }

                if let Some(current_duration) = try_percent_line(&line_str) {
                    let total_duration = {
                        let running_tasks = running_tasks_state.lock().unwrap();
                        running_tasks
                            .iter()
                            .find(|t| t.id == id)
                            .map(|t| t.duration)
                            .unwrap_or(0)
                    };

                    if total_duration > 0 {
                        let percent =
                            (current_duration as f64 / total_duration as f64 * 100.0).round() as u8;
                        let percent = percent.min(100);

                        {
                            let mut running_tasks = running_tasks_state.lock().unwrap();
                            if let Some(task) = running_tasks.iter_mut().find(|t| t.id == id) {
                                task.percent = percent;
                            }
                        }

                        let _ = webview_window.set_progress_bar(ProgressBarState {
                            status: None,
                            progress: Some(percent as u64),
                        });
                        channel
                            .send(ParseEvent::PercentProgress { id: &id, percent })
                            .map_err(|e| e.to_string())?;
                    }
                }

                if need_std_output {
                    channel
                        .send(ParseEvent::StdOutput {
                            id: &id,
                            r#type: "stderr",
                            content: &line_str,
                        })
                        .unwrap();
                }
            }
            CommandEvent::Terminated(payload) => {
                {
                    let mut running_tasks = running_tasks_state.lock().unwrap();
                    running_tasks.retain(|x| x.id != id.clone());
                }
                let _ = webview_window.request_user_attention(Some(UserAttentionType::Informational));
                let _ = webview_window.set_progress_bar(ProgressBarState {
                    status: Some(ProgressBarStatus::None),
                    progress: None,
                });
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(RunningTasks::default())
        .setup(move |app| {
            #[cfg(debug_assertions)]
            if let Some(webview) = app.get_webview_window("main") {
                webview.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![start_parse, terminate_parse])
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                let running_tasks_state = window.state::<RunningTasks>();
                match running_tasks_state.inner().lock() {
                    Ok(running_tasks) => {
                        if !running_tasks.is_empty() {
                            let user_result = window.dialog()
                                .message("You have running parsing task, close application will stop parsing and leave target file in middle state. Are you sure to TERMINATE parsing and exit?")
                                .title("Confirm")
                                .buttons(MessageDialogButtons::OkCancelCustom(
                                    String::from("Terminate and Exit"),
                                    String::from("Cancel")
                                ))
                                .blocking_show();

                            if !user_result {
                                return api.prevent_close();
                            }

                            let result = async_runtime::block_on(async move {
                                utils::kill_tasks(
                                    window.shell(),
                                    running_tasks.iter().map(|task| task.pid.to_string()).collect::<Vec<String>>(),
                                ).await
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
