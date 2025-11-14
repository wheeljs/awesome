# ffmpeg-preset

调用ffmpeg进行视频压缩，支持一些常见参数，具体参见源码

## Prerequisites

Prerequisites and Setup are different depending on which bash you want to use.

- FFmpeg for windows

- Git Bash

### low-video.bash

- Cuda(without this, you cannot enable `--gpu`)

*Windows 11 24H2 + git version 2.51.1.windows.1 + ffmpeg-n8.0-latest-win64-gpl-8.0*

## Setup

1. clone this repository

### low-video.bash

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

### extract-audio.bash

1. Link `extract-audio.bash` to the source videos folder

    ```powershell
    # Run as Powershell Administrator

    # 创建一个符号链接指向 .bash 文件
    New-Item -ItemType SymbolicLink -Path "C:\path\to\videos\extract-audio.bash" -Target "C:\path\to\repo\ffmpeg-preset\extract-audio.bash"
    ```

1. Set `TARGET_DIR`, `FFMPEG_BIN` variables in `extract-audio.bash`

    ```bash
    # 用户自定义参数
    TARGET_DIR="/path/to/dest/" # 输出目录
    FFMPEG_BIN="$(which ffmpeg)" # 自动查找 ffmpeg 路径（也可手动填写）
    ```

1. Extract audio from your videos

    ```bash
    # Run with Git Bash
    ./extract-audio.bash
    ```