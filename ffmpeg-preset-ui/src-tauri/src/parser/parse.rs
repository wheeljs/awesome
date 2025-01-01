use once_cell::sync::Lazy;
use regex::Regex;
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

static CONVERTING_LINE_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"Convert(?<status>\w+?)(?: (?<result>\w+):)? (?<input_path>.+?) ===> (?<output_path>.+)").unwrap());

#[derive(Debug, PartialEq)]
pub enum ConvertStatusLine {
    Started,
    Succeed,
    Failed,
}

pub fn try_converting_line(line: &str) -> Option<(ConvertStatusLine, (&str, &str))> {
    if CONVERTING_LINE_REGEX.is_match(line) {
        if let Some(caps) = CONVERTING_LINE_REGEX.captures(line) {
            let file = (caps.name("input_path").unwrap().as_str(), caps.name("output_path").unwrap().as_str());
            match caps.name("status").unwrap().as_str() {
                "ing" => {
                    return Some((ConvertStatusLine::Started, file));
                },
                "ed" => {
                    return match caps.name("result").unwrap().as_str() {
                        "success" => Some((ConvertStatusLine::Succeed, file)),
                        "failed" => Some((ConvertStatusLine::Failed, file)),
                        _ => None,
                    }
                },
                _ => {},
            }
        }
    }

    return None;
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
            Some((ConvertStatusLine::Started, ("/path/to/video.mp4", "/path/to/target.mp4"))),
        );
        assert_eq!(
            try_converting_line("Converting /path/t\\ o/video.mp4 ===> /path/t\\ o/target.mp4"),
            Some((ConvertStatusLine::Started, ("/path/t\\ o/video.mp4", "/path/t\\ o/target.mp4"))),
        );
        assert_eq!(
            try_converting_line("Converting success: /path/to/video.mp4 ===> /path/to/target.mp4"),
            Some((ConvertStatusLine::Started, ("/path/to/video.mp4", "/path/to/target.mp4"))),
        );
        assert_eq!(
            try_converting_line("Converted success: /path/to/video.mp4 ===> /path/to/target.mp4"),
            Some((ConvertStatusLine::Succeed, ("/path/to/video.mp4", "/path/to/target.mp4"))),
        );
        assert_eq!(
            try_converting_line("Converted failed: /path/to/video.mp4 ===> /path/to/target.mp4"),
            Some((ConvertStatusLine::Failed, ("/path/to/video.mp4", "/path/to/target.mp4"))),
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
}
