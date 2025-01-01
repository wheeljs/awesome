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
