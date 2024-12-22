use std::sync::MutexGuard;
use tauri::{Manager, Window};
use tauri_plugin_shell::ShellExt;
use serde::{Deserialize, Deserializer};
use base64::{Engine as _, engine::general_purpose};
use uuid::Uuid;
use once_cell::sync::Lazy;
use regex::Regex;
use chrono::{NaiveTime, ParseResult, Timelike};

use super::ParseTask;

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

pub async fn kill_tasks(window: Window, running_tasks: MutexGuard<'_, Vec<ParseTask>>) -> bool {
    #[cfg(windows)]
    {
        let mut pids = running_tasks
            .iter()
            .flat_map(|task| vec!["/PID".to_string(), task.pid.to_string()])
            .collect::<Vec<String>>();
        let mut taskkill_args = vec![String::from("/F"), String::from("/T")];
        taskkill_args.append(&mut pids);

        let kill_result = window
            .app_handle()
            .shell()
            .command("taskkill")
            .args(taskkill_args)
            .status()
            .await;

        match kill_result {
            Ok(exit_status) => exit_status.success(),
            Err(_) => false,
        }
    }

    #[cfg(not(windows))]
    false
}

const TIME_FORMAT: &str = "%H:%M:%S%.f";

static DURATION_LINE_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"Duration:(.*),\sstart").unwrap());

fn time_str_to_milliseconds(time_str: &str, format: Option<&str>) -> ParseResult<u64> {
    let fmt = format.or(Some(TIME_FORMAT)).unwrap();

    let time = NaiveTime::parse_from_str(time_str, fmt)?;

    Ok(
        time.num_seconds_from_midnight() as u64 * 1000
            + (time.nanosecond() / 100_0000) as u64,
    )
}

pub fn try_duration_line(line: &str) -> Option<u64> {
    if !DURATION_LINE_REGEX.is_match(line) {
        return None;
    }

    let duration_caps = DURATION_LINE_REGEX.captures(line).unwrap();
    let duration_str = duration_caps.get(1).unwrap().as_str().trim();

    time_str_to_milliseconds(duration_str, None).ok()
}

static PERCENTAGE_LINE_REGEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"time=(.*)\sbitrate=").unwrap());

pub fn try_percent_line(line: &str) -> Option<u64> {
    if !PERCENTAGE_LINE_REGEX.is_match(line) {
        return None;
    }

    let percent_caps = PERCENTAGE_LINE_REGEX.captures(line).unwrap();
    let percent_str = percent_caps.get(1).unwrap().as_str().trim();

    time_str_to_milliseconds(percent_str, None).ok()
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn try_duration_line_works() {
        assert_eq!(
            try_duration_line("frame=87506 fps=313 q=20.0 size=  558592kB time=00:48:36.98 bitrate=1568.7kbits/s speed=10.5x    \r"),
            None
        );
        assert_eq!(
            try_duration_line(" Duration: 00:31:32.22, start: 1.501000, bitrate: 11441 kb/s"),
            Some(189_2220)
        );
        assert_eq!(
            try_duration_line(" Duration: 00:00:01.505, start: 1.501000, bitrate: 11441 kb/s"),
            Some(1505)
        );
    }

    #[test]
    fn try_percent_line_works() {
        assert_eq!(
            try_percent_line("frame=87506 fps=313 q=20.0 size=  558592kB time=00:48:36.98 bitrate=1568.7kbits/s speed=10.5x    \r"),
            Some(291_6980)
        );
        assert_eq!(
            try_percent_line(" Duration: 00:31:32.22, start: 1.501000, bitrate: 11441 kb/s"),
            None
        );
        assert_eq!(
            try_percent_line(" Duration: 00:00:01.505, start: 1.501000, bitrate: 11441 kb/s"),
            None
        );
    }
}
