use tauri::Wry;
use tauri_plugin_shell::Shell;
use serde::{Deserialize, Deserializer};
use base64::{Engine as _, engine::general_purpose};
use uuid::Uuid;
use chrono::{NaiveTime, ParseResult, Timelike};

pub fn deserialize_files<'de, D>(deserializer: D) -> Result<Vec<(String, Option<String>)>, D::Error>
where
    D: Deserializer<'de>,
{
    let vec: Vec<Vec<Option<String>>> = Vec::deserialize(deserializer)?;

    vec.into_iter()
        .map(|mut file| {
            if file.is_empty() {
                return Err(serde::de::Error::custom("File entry cannot be empty"));
            } else if file.len() > 2 {
                return Err(serde::de::Error::custom(
                    "File entry can have at most two elements",
                ));
            }

            // 提取第一个元素，并确保它是 Some(String)
            let first_opt = file.remove(0);
            let first = first_opt
                .ok_or_else(|| serde::de::Error::custom("First element cannot be null"))?;

            // 如果有第二个元素，则取出来；否则为 None
            let second = if !file.is_empty() {
                file.remove(0)
            } else {
                None
            };

            Ok((first, second))
        })
        .collect()
}

pub fn generate_uuid() -> String {
    let uuid = Uuid::new_v4();
    let bytes = uuid.as_bytes();
    return general_purpose::URL_SAFE_NO_PAD.encode(bytes);
}

pub async fn kill_tasks<T>(shell: &Shell<Wry>, running_task_ids: T) -> bool
where
    T: IntoIterator,
    T::Item: AsRef<str>,
{
    #[cfg(windows)]
    {
        let mut pids = running_task_ids
            .into_iter()
            .flat_map(|task_id| vec!["/PID".to_string(), task_id.as_ref().to_string()])
            .collect::<Vec<String>>();
        let mut taskkill_args = vec![String::from("/F"), String::from("/T")];
        taskkill_args.append(&mut pids);

        let kill_result = shell.command("taskkill").args(taskkill_args).status().await;

        match kill_result {
            Ok(exit_status) => exit_status.success(),
            Err(_) => false,
        }
    }

    #[cfg(not(windows))]
    false
}

const TIME_FORMAT: &str = "%H:%M:%S%.f";

pub fn time_str_to_milliseconds(time_str: &str, format: Option<&str>) -> ParseResult<u64> {
    let fmt = format.or(Some(TIME_FORMAT)).unwrap();

    let time = NaiveTime::parse_from_str(time_str, fmt)?;

    Ok(time.num_seconds_from_midnight() as u64 * 1000 + (time.nanosecond() / 100_0000) as u64)
}
