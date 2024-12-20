use std::path::Path;
use serde::{Serialize, Deserialize};
use regex::Regex;
use once_cell::sync::Lazy;

use super::utils::deserialize_files;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseOptions {
    command: String,
    bash_file: String,
    #[serde(default)]
    gpu: bool,
    resize: Option<String>,
    bitrate: Option<String>,
    #[serde(deserialize_with = "deserialize_files")]
    files: Vec<(String, Option<String>)>,
}

pub struct ParseCommand {
    pub command: String,
    pub args: Vec<String>,
}

impl ParseCommand {
    pub fn args_str(&self) -> String {
        self.args.join(" ")
    }
}

static WINDOWS_STYLE_PATH_REGEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"^.*:\\").unwrap());

fn ensure_unix_path<P: AsRef<Path>>(path: P) -> String {
    let path = path.as_ref();

    let path_str = path.to_string_lossy();

    if WINDOWS_STYLE_PATH_REGEX.is_match(&path_str) {
        if let Some((driver, tail)) = path_str.split_once(":\\") {
            return format!("/{}/{}", driver.to_lowercase(), tail.replace("\\", "/"));
        }
    }

    path_str.to_string()
}

fn ensure_bash_file(bash_file: String) -> Vec<String> {
    let bash_file_path = Path::new(&bash_file);

    let mut bash_file_with_cd: Vec<String> = vec![];
    if let Some(parent) = bash_file_path.parent() {
        bash_file_with_cd.push(format!("cd {} &&", ensure_unix_path(parent)));
    }
    if let Some(file_name) = bash_file_path.file_name() {
        bash_file_with_cd.push(file_name.to_string_lossy().to_string());
    }

    bash_file_with_cd
}

impl ParseCommand {
    pub fn build(options: ParseOptions) -> Self {
        let mut bash_file_args = ensure_bash_file(options.bash_file);

        if options.gpu {
            bash_file_args.push("--gpu".to_string());
        }
        if let Some(resize) = options.resize {
            bash_file_args.push("--resize".to_string());
            bash_file_args.push(resize);
        }
        if let Some(bitrate) = options.bitrate {
            bash_file_args.push("--bitrate".to_string());
            bash_file_args.push(bitrate);
        }

        bash_file_args.extend(options.files.into_iter().map(|(source, target)| {
            let ensured_source = ensure_unix_path(Path::new(&source));
            match target {
                Some(target) => {
                    let ensured_target = ensure_unix_path(Path::new(&target));
                    format!("{ensured_source}:{ensured_target}")
                }
                None => ensured_source,
            }
        }));

        Self {
            command: options.command,
            args: bash_file_args,
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum ParseEvent<'a> {
    #[serde(rename_all = "camelCase")]
    Started { id: &'a str },
    #[serde(rename_all = "camelCase")]
    Progress {
        id: &'a str,
        r#type: &'a str,
        content: &'a str,
    },
    #[serde(rename_all = "camelCase")]
    Finished { id: &'a str, success: bool },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let command = ParseCommand::build(ParseOptions {
            command: String::from("/usr/bin/bash"),
            bash_file: String::from("/path/to/ffmpeg/bin/low-video.bash"),
            gpu: false,
            resize: None,
            bitrate: None,
            files: vec![(String::from("video1.mp4"), None)],
        });

        assert_eq!(command.command, "/usr/bin/bash");
        assert_eq!(
            command.args_str(),
            "cd /path/to/ffmpeg/bin && low-video.bash video1.mp4"
        );
    }

    #[test]
    fn it_works_with_gpu() {
        let command = ParseCommand::build(ParseOptions {
            command: String::from("/usr/bin/bash"),
            bash_file: String::from("/path/to/ffmpeg/bin/low-video.bash"),
            gpu: true,
            resize: None,
            bitrate: None,
            files: vec![(String::from("video1.mp4"), None)],
        });

        assert!(command.args_str().contains("--gpu"));
    }

    #[test]
    fn it_works_with_files() {
        let command = ParseCommand::build(ParseOptions {
            command: String::from("/usr/bin/bash"),
            bash_file: String::from("/path/to/ffmpeg/bin/low-video.bash"),
            gpu: false,
            resize: None,
            bitrate: None,
            files: vec![
                (String::from("video1.mp4"), None),
                (String::from("video2.mp4"), None),
            ],
        });

        assert_eq!(
            command.args_str(),
            "cd /path/to/ffmpeg/bin && low-video.bash video1.mp4 video2.mp4"
        );
    }

    #[test]
    fn it_works_with_files_with_target() {
        let command = ParseCommand::build(ParseOptions {
            command: String::from("/usr/bin/bash"),
            bash_file: String::from("/path/to/ffmpeg/bin/low-video.bash"),
            gpu: false,
            resize: None,
            bitrate: None,
            files: vec![
                (
                    String::from("E:\\videos\\video1.mp4"),
                    Some(String::from("E:\\videos-target\\")),
                ),
                (String::from("E:\\videos\\video2.mp4"), None),
            ],
        });

        assert_eq!(
            command.args_str(),
            "cd /path/to/ffmpeg/bin && low-video.bash /e/videos/video1.mp4:/e/videos-target/ /e/videos/video2.mp4"
        );
    }

    #[test]
    fn it_works_with_resize() {
        let command = ParseCommand::build(ParseOptions {
            command: String::from("/usr/bin/bash"),
            bash_file: String::from("/path/to/ffmpeg/bin/low-video.bash"),
            gpu: false,
            resize: Some(String::from("1440:-1")),
            bitrate: None,
            files: vec![(String::from("video1.mp4"), None)],
        });

        assert_eq!(
            command.args_str(),
            "cd /path/to/ffmpeg/bin && low-video.bash --resize 1440:-1 video1.mp4"
        );
    }

    #[test]
    fn it_works_with_bitrate() {
        let command = ParseCommand::build(ParseOptions {
            command: String::from("/usr/bin/bash"),
            bash_file: String::from("/path/to/ffmpeg/bin/low-video.bash"),
            gpu: false,
            resize: None,
            bitrate: Some(String::from("2M")),
            files: vec![(String::from("video1.mp4"), None)],
        });

        assert_eq!(
            command.args_str(),
            "cd /path/to/ffmpeg/bin && low-video.bash --bitrate 2M video1.mp4"
        );
    }
}
