use tauri::{ipc::Channel, AppHandle};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};
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

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn test_execute(app: AppHandle, on_event: Channel<ParseEvent<'_>>) {
    let id = generate_uuid();
    let shell = app.shell();
    
    let command = shell
        .command("C:\\Program Files\\Git\\usr\\bin\\bash.exe")
        .args([
            "--login",
            "-c",
            "echo Hello from rust!"
        ]);

    let (mut rx, _) = command
        .spawn()
        .expect("Failed to start command");
   
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
                on_event.send(ParseEvent::Finished {
                    id: &id,
                    success: matches!(payload.code, Some(0)),
                    err: Some("Something went wrong"),
                }).unwrap();
            },
            _ => {},
        }
    }

    
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
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet])
        .invoke_handler(tauri::generate_handler![test_execute])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
