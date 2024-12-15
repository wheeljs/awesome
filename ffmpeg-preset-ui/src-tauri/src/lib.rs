use std::{collections::HashMap, sync::{Arc, Mutex}};

use tauri::{ipc::Channel, AppHandle, Manager, RunEvent, State, WindowEvent};
use tauri_plugin_shell::{process::{CommandChild, CommandEvent}, ShellExt};
use serde::Serialize;
use uuid::Uuid;
use base64::{Engine as _, engine::general_purpose};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum ParseEvent<'a> {
    #[serde(rename_all = "camelCase")]
    Started {
        id: &'a str,
    },
    #[serde(rename_all = "camelCase")]
    Progress {
        id: &'a str,
        r#type: &'a str,
        content: String,
    },
    #[serde(rename_all = "camelCase")]
    Finished {
        id: &'a str,
        success: bool,
        err: Option<&'a str>,
    }
}

fn generate_uuid() -> String {
    let uuid = Uuid::new_v4();
    let bytes = uuid.as_bytes();
    return general_purpose::URL_SAFE_NO_PAD.encode(bytes);
}

// struct AppState {
//     greet_history: Vec<String>,
// }

// impl AppState {
//     fn new() -> Arc<Mutex<Self>> {
//         Arc::new(Mutex::new(Self {
//             greet_history: vec![]
//         }))
//     }

//     fn add(&mut self, id: String) {
//         self.greet_history.push(id);
//     }
// }

// #[tauri::command]
// fn greet(name: &str, state: State<'_, Arc<Mutex<AppState>>>) -> String {
//     if let Ok(mut state) = state.lock() {
//         state.add(name.to_string());
//     }
//     format!("Hello, {}! You've been greeted from Rust!", name)
// }

// #[tauri::command]
// fn greet_history(state: State<'_, Arc<Mutex<AppState>>>) -> String {
//     state.lock().unwrap().greet_history.join("////")
// }

struct AppState {
    running_commands: HashMap<String, CommandChild>,
    exit_count: u8,
}

impl AppState {
    fn new() -> Arc<Mutex<Self>> {
        Arc::new(Mutex::new(AppState {
            running_commands: HashMap::new(),
            exit_count: 0,
        }))
    }

    fn add_command(&mut self, id: String, child: CommandChild) {
        self.running_commands.insert(id, child);
    }

    fn remove_command(&mut self, id: &str) {
        self.running_commands.remove(id);
    }

    fn has_running_commands(&self) -> bool {
        !self.running_commands.is_empty()
    }

    fn kill_all_commands(&mut self) -> bool {
        let mut all_commands_killed = true;
        for (id, _) in &self.running_commands {
            if let Some(child) = self.running_commands.remove(id) {
                if let Err(_) = child.kill() {
                    all_commands_killed = false;
                }
            }
        }

        all_commands_killed
        // self.running_commands
        //     .values_mut()
        //     // .map(|mut child| child.kill())
        //     .map(|child| *child.kill())
        //     .all(|result| result.is_ok())
    }
}

#[tauri::command]
async fn test_execute(
    app_handle: AppHandle,
    state_wrapper: State<'_, Arc<Mutex<AppState>>>,
    on_event: Channel<ParseEvent<'_>>
) -> Result<(), String> {
    let id = generate_uuid();
    let shell = app_handle.shell();
    
    let command = shell
        .command("C:\\Program Files\\Git\\usr\\bin\\bash.exe")
        .args([
            "--login",
            "-c",
            "echo Hello from rust!"
        ]);

    let (mut rx, child) = command
        .spawn()
        .expect("Failed to start command");
   
    {
        let mut lock = state_wrapper.lock().unwrap();
        lock.add_command(id.clone(), child);
    }

    on_event.send(ParseEvent::Started {
        id: &id,
    }).unwrap();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                on_event.send(ParseEvent::Progress {
                    id: &id,
                    r#type: "stdout",
                    content: String::from_utf8(line).unwrap(),
                }).unwrap();
            },
            CommandEvent::Stderr(line) => {
                on_event.send(ParseEvent::Progress {
                    id: &id,
                    r#type: "stderr",
                    content: String::from_utf8(line).unwrap(),
                }).unwrap();
            },
            CommandEvent::Terminated(payload) => {
                {
                    let mut lock = state_wrapper.lock().unwrap();
                    lock.remove_command(&id);
                }
                on_event.send(ParseEvent::Finished {
                    id: &id,
                    success: matches!(payload.code, Some(0)),
                    err: Some("Something went wrong"),
                }).unwrap();
            },
            _ => {},
        }
    }

    Ok(())    
    // let status = child.status().await;
    // match status {
    //     Ok(_) => {
    //         on_event.send(ParseEvent::Finished {
    //             id: &id,
    //             success: true,
    //             err: None,
    //         });
    //     },
    //     Err(e) => {
    //         on_event.send(ParseEvent::Finished {
    //             id: &id,
    //             success: true,
    //             err: Some(&e.to_string()),
    //         });
    //     },
    // }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        // .manage(AppState::new())
        // .manage(AppState::new())
        .manage(AppState::new())
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            #[cfg(debug_assertions)]
            if let Some(webview) = app.get_webview_window("main") {
                webview.open_devtools();
            }

            Ok(())
        });

    #[allow(unused_mut)]
    let mut app = builder
        .invoke_handler(tauri::generate_handler![test_execute])
        .on_window_event(|window_handle, event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    println!("WindowEvent::CloseRequested");
                    let state_wrapper = window_handle.state::<Arc<Mutex<AppState>>>();
                    if let Ok(mut state) = state_wrapper.inner().lock() {
                        println!("WindowEvent::CloseRequested {:?}, {}, exit_count={}", state.running_commands, state.has_running_commands(), state.exit_count);
                        if state.has_running_commands() {
                            if state.exit_count == 0 {
                                state.exit_count += 1;
                                api.prevent_close();
                            } else {
                                let success = state.kill_all_commands();
                                if !success {
                                    api.prevent_close();
                                }
                            }
                        }
                    }
                },
                _ => {},
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app
        // .on_event(|app_handle, event| {
        //     match event {
        //         RunEvent::ExitRequested { api, .. } => {
        //             let app_state = app_handle.state::<AppState>();
        //             if app_state.inner().running_commands.len() > 0 {

        //                 api.prevent_exit();
        //             }
        //         },
        //         _ => {},
        //     }
        // })
        .run(move |app_handle, event| {
            match event {
                RunEvent::ExitRequested { api, .. } => {
                    println!("RunEvent::ExitRequested");
                    let state_wrapper = app_handle.state::<Arc<Mutex<AppState>>>();
                    if let Ok(state) = state_wrapper.inner().lock() {
                        println!("RunEvent::ExitRequested: {:?}, {}", state.running_commands, state.has_running_commands());
                        if state.has_running_commands() {
                            api.prevent_exit();
                        }
                    }
                },
                _ => {},
            }
        });
}
