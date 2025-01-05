use std::sync::Mutex;
use tauri::{
    async_runtime,
    ipc::Channel,
    window::{ProgressBarState, ProgressBarStatus},
    AppHandle, State, UserAttentionType, WebviewWindow,
};
use tauri_plugin_shell::{ShellExt, process::CommandEvent};
use serde::Deserialize;

use super::{ParseCommand, ParseOptions, ParseEvent, Summary};
use super::parse::{
    ConvertStatusLine, try_converting_line, try_duration_line, try_percent_line, try_summary_line,
};
use super::utils::{self, generate_uuid};

pub struct ParseTask {
    id: String,
    pub pid: u32,
    command: ParseCommand,
    duration: u64,
    percent: u8,
}

pub type RunningTasks = Mutex<Vec<ParseTask>>;

#[tauri::command]
pub fn terminate_parse(
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
pub struct TaskOptions {
    need_std_output: Option<bool>,
}

#[tauri::command]
pub async fn start_parse(
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

    let mut summaries: Vec<Summary> = vec![];
    while let Some(event) = rx.recv().await {
        let need_std_output = task_options.need_std_output.unwrap_or(false);

        let _ = webview_window.set_progress_bar(ProgressBarState {
            status: Some(ProgressBarStatus::Normal),
            progress: Some(0),
        });
        match event {
            CommandEvent::Stdout(line) => {
                let line_str = String::from_utf8_lossy(&line);

                if let Some(status) = try_converting_line(&line_str) {
                    channel
                        .send(ConvertStatusLine::<'_>::to_parse_event(&status, &id))
                        .unwrap();
                }
                if let Some(summary) = try_summary_line(&line_str) {
                    summaries.push(summary);
                }

                if need_std_output {
                    channel
                        .send(ParseEvent::StdOutput {
                            id: &id,
                            r#type: "stdout",
                            content: &line_str,
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

                        let mut running_tasks = running_tasks_state.lock().unwrap();
                        if let Some(task) = running_tasks.iter_mut().find(|t| t.id == id) {
                            if task.percent != percent {
                                task.percent = percent;

                                let _ = webview_window.set_progress_bar(ProgressBarState {
                                    status: None,
                                    progress: Some(percent as u64),
                                });
                                channel
                                    .send(ParseEvent::PercentProgress { id: &id, percent })
                                    .map_err(|e| e.to_string())?;
                            }
                        }
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
                let _ =
                    webview_window.request_user_attention(Some(UserAttentionType::Informational));
                let _ = webview_window.set_progress_bar(ProgressBarState {
                    status: Some(ProgressBarStatus::None),
                    progress: None,
                });

                channel
                    .send(ParseEvent::Finished {
                        id: &id,
                        success: matches!(payload.code, Some(0)),
                        summaries: summaries.clone(),
                    })
                    .unwrap();
            }
            _ => {}
        }
    }

    Ok(())
}
