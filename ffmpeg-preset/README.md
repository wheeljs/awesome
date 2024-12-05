# ffmpeg-preset

调用ffmpeg进行视频压缩，支持一些常见参数，具体参见源码

## Prerequests

- FFmpeg for windows

- Git Bash

- Cuda(without this, you cannot enable `--gpu`)

*Windows 10 22H2 + git 2.44.0.windows.1 + ffmpeg full 4.4.1 build + Cuda 12.2 was tested*

## Setup

1. clone this repository

1. Link `low-video.bash`, `sync-time.ps1` to same folder with `ffmpeg.exe`

    ```powershell
    # Run as Powershell Administrator

    # 创建一个符号链接指向 .bash 文件
    New-Item -ItemType SymbolicLink -Path "C:\path\to\ffmpeg\bin\low-video.bash" -Target "C:\path\to\repo\ffmpeg-preset\low-video.bash"

    # 创建一个符号链接指向 .ps1 文件
    New-Item -ItemType SymbolicLink -Path "C:\path\to\ffmpeg\bin\sync-time.ps1" -Target "C:\path\to\repo\ffmpeg-preset\sync-time.ps1"
    ```

1. Compress your videos

    ```bash
    # Run with Git Bash
    ./low-video.bash --gpu /path/to/origin-video.mp4:/path/to/output/
    ```
