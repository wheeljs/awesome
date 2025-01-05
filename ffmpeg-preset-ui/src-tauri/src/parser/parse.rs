use once_cell::sync::Lazy;
use regex::Regex;

use super::{ParseEvent, ParseFileEventPayload, Summary};
use super::super::utils;

static DURATION_LINE_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"Duration:(.*),\sstart").unwrap());

pub fn try_duration_line(line: &str) -> Option<u64> {
    if !DURATION_LINE_REGEX.is_match(line) {
        return None;
    }

    let duration_caps = DURATION_LINE_REGEX.captures(line).unwrap();
    let duration_str = duration_caps.get(1).unwrap().as_str().trim();

    utils::time_str_to_milliseconds(duration_str, None).ok()
}

static PERCENTAGE_LINE_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"time=(.*)\sbitrate=").unwrap());

pub fn try_percent_line(line: &str) -> Option<u64> {
    if !PERCENTAGE_LINE_REGEX.is_match(line) {
        return None;
    }

    let percent_caps = PERCENTAGE_LINE_REGEX.captures(line).unwrap();
    let percent_str = percent_caps.get(1).unwrap().as_str().trim();

    utils::time_str_to_milliseconds(percent_str, None).ok()
}

static CONVERTING_LINE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"Convert(?<status>\w+?)(?: (?<result>\w+):)? (?<input_path>.+?) ===> (?<output_path>.+)",
    )
    .unwrap()
});

type FileTuple<'a> = (&'a str, &'a str);
#[derive(Debug, PartialEq)]
pub enum ConvertStatusLine<'a> {
    Started(FileTuple<'a>),
    Succeed(FileTuple<'a>),
    Failed(FileTuple<'a>),
}

impl ConvertStatusLine<'_> {
    pub fn to_parse_event<'a>(value: &'a Self, id: &'a str) -> ParseEvent<'a> {
        match value {
            Self::Started(file) => ParseEvent::StartParseFile(ParseFileEventPayload {
                id,
                source: file.0,
                target: file.1,
            }),
            Self::Succeed(file) => ParseEvent::ParseFileSuccess(ParseFileEventPayload {
                id,
                source: file.0,
                target: file.1,
            }),
            Self::Failed(file) => ParseEvent::ParseFileFailed(ParseFileEventPayload {
                id,
                source: file.0,
                target: file.1,
            }),
        }
    }
}

pub fn try_converting_line(line: &str) -> Option<ConvertStatusLine> {
    if CONVERTING_LINE_REGEX.is_match(line) {
        if let Some(caps) = CONVERTING_LINE_REGEX.captures(line) {
            let file = (
                caps.name("input_path").unwrap().as_str(),
                caps.name("output_path").unwrap().as_str(),
            );
            match caps.name("status").unwrap().as_str() {
                "ing" => {
                    return Some(ConvertStatusLine::Started(file));
                }
                "ed" => {
                    return match caps.name("result").unwrap().as_str() {
                        "success" => Some(ConvertStatusLine::Succeed(file)),
                        "failed" => Some(ConvertStatusLine::Failed(file)),
                        _ => None,
                    }
                }
                _ => {}
            }
        }
    }

    None
}

static SUMMARY_LINE_REG: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"Input:\s*(?<source>[^\n,]+),\s*Size:\s*(?<source_size>[\d.]+\s*MB)\s*===>\s*Output:\s*(?<target>[^\n,]+),\s*Size:\s*(?<target_size>[\d.]+\s*MB),\s*(?<reduce_size>[\d.]+\s*MB)\s*smaller\s*than\s*origin").unwrap()
});

pub fn try_summary_line(line: &str) -> Option<Summary> {
    if !SUMMARY_LINE_REG.is_match(line) {
        return None;
    }

    SUMMARY_LINE_REG.captures(line).and_then(|caps| {
        Some(Summary {
            source: caps.name("source").unwrap().as_str().to_owned(),
            source_size: caps.name("source_size").unwrap().as_str().to_owned(),
            target: caps.name("target").unwrap().as_str().to_owned(),
            target_size: caps.name("target_size").unwrap().as_str().to_owned(),
            reduce_size: caps.name("reduce_size").unwrap().as_str().to_owned(),
        })
    })
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

    #[test]
    fn try_converting_line_works() {
        assert_eq!(
            try_converting_line("Converting /path/to/video.mp4 ===> /path/to/target.mp4"),
            Some(ConvertStatusLine::Started((
                "/path/to/video.mp4",
                "/path/to/target.mp4"
            ))),
        );
        assert_eq!(
            try_converting_line("Converting /path/t\\ o/video.mp4 ===> /path/t\\ o/target.mp4"),
            Some(ConvertStatusLine::Started((
                "/path/t\\ o/video.mp4",
                "/path/t\\ o/target.mp4"
            ))),
        );
        assert_eq!(
            try_converting_line("Converting success: /path/to/video.mp4 ===> /path/to/target.mp4"),
            Some(ConvertStatusLine::Started((
                "/path/to/video.mp4",
                "/path/to/target.mp4"
            ))),
        );
        assert_eq!(
            try_converting_line("Converted success: /path/to/video.mp4 ===> /path/to/target.mp4"),
            Some(ConvertStatusLine::Succeed((
                "/path/to/video.mp4",
                "/path/to/target.mp4"
            ))),
        );
        assert_eq!(
            try_converting_line("Converted failed: /path/to/video.mp4 ===> /path/to/target.mp4"),
            Some(ConvertStatusLine::Failed((
                "/path/to/video.mp4",
                "/path/to/target.mp4"
            ))),
        );
        assert_eq!(
            try_converting_line("frame=87506 fps=313 q=20.0 size=  558592kB time=00:48:36.98 bitrate=1568.7kbits/s speed=10.5x    \r"),
            None
        );
        assert_eq!(
            try_converting_line(" Duration: 00:31:32.22, start: 1.501000, bitrate: 11441 kb/s"),
            None
        );
        assert_eq!(
            try_converting_line(" Duration: 00:00:01.505, start: 1.501000, bitrate: 11441 kb/s"),
            None
        );
    }

    #[test]
    fn try_summary_line_works() {
        assert_eq!(
            try_summary_line("Input: /path/to/video.mp4, Size: 2114.96 MB  ===> Output: /path/to/video.low.mp4, Size: 669.21 MB, 1445.75 MB smaller than origin\n"),
            Some(Summary {
                source: String::from("/path/to/video.mp4"),
                source_size: String::from("2114.96 MB"),
                target: String::from("/path/to/video.low.mp4"),
                target_size: String::from("669.21 MB"),
                reduce_size: String::from("1445.75 MB"),
            })
        );
        assert_eq!(
            try_summary_line("Converting /path/to/video.mp4 ===> /path/to/target.mp4"),
            None
        );
        assert_eq!(
            try_summary_line("Converting /path/t\\ o/video.mp4 ===> /path/t\\ o/target.mp4"),
            None
        );
        assert_eq!(
            try_summary_line("Converting success: /path/to/video.mp4 ===> /path/to/target.mp4"),
            None
        );
        assert_eq!(
            try_summary_line("Converted success: /path/to/video.mp4 ===> /path/to/target.mp4"),
            None
        );
        assert_eq!(
            try_summary_line("Converted failed: /path/to/video.mp4 ===> /path/to/target.mp4"),
            None
        );
        assert_eq!(
            try_summary_line("frame=87506 fps=313 q=20.0 size=  558592kB time=00:48:36.98 bitrate=1568.7kbits/s speed=10.5x    \r"),
            None
        );
        assert_eq!(
            try_summary_line(" Duration: 00:31:32.22, start: 1.501000, bitrate: 11441 kb/s"),
            None
        );
        assert_eq!(
            try_summary_line(" Duration: 00:00:01.505, start: 1.501000, bitrate: 11441 kb/s"),
            None
        );
    }
}
