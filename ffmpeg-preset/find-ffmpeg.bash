#!/bin/bash
# 公共 ffmpeg 查找逻辑
# 优先使用 PATH 中的 ffmpeg；如果找不到，再使用环境变量 FFMPEG_PATH（可以是可执行文件或目录）

function find_ffmpeg() {
  # 1) PATH 中的 ffmpeg 优先
  if command -v ffmpeg >/dev/null 2>&1; then
    FFMPEG_BIN=$(command -v ffmpeg)
    export FFMPEG_BIN
  fi

  # 2) 使用环境变量 FFMPEG_PATH（支持目录或直接可执行路径）
  if [ -z "$FFMPEG_BIN" ] && [ -n "$FFMPEG_PATH" ]; then
    candidate="$FFMPEG_PATH"
    # 如果是目录，尝试拼接常见可执行名
    if [ -d "$candidate" ]; then
      if [ -x "$candidate/ffmpeg.exe" ]; then
        candidate="$candidate/ffmpeg.exe"
      elif [ -x "$candidate/ffmpeg" ]; then
        candidate="$candidate/ffmpeg"
      fi
    fi

    # 如果 candidate 是可执行文件或存在文件则使用
    if [ -x "$candidate" ] || [ -f "$candidate" ]; then
      # 尝试 realpath，失败则直接使用 candidate
      if command -v realpath >/dev/null 2>&1; then
        FFMPEG_BIN=$(realpath "$candidate")
      else
        FFMPEG_BIN="$candidate"
      fi
      export FFMPEG_BIN
    fi
  fi

  # 如果没有找到 ffmpeg，则返回失败
  if [ -z "$FFMPEG_BIN" ]; then
    return 1
  fi

  # 查找 ffprobe（同目录下，支持 Windows）
  local ffprobe_candidate="$(dirname "$FFMPEG_BIN")/ffprobe"
  if [ -x "$ffprobe_candidate" ]; then
    FFPROBE_BIN="$ffprobe_candidate"
  elif [ -x "${ffprobe_candidate}.exe" ]; then
    FFPROBE_BIN="${ffprobe_candidate}.exe"
  else
    # 兜底：尝试 PATH
    if command -v ffprobe >/dev/null 2>&1; then
      FFPROBE_BIN=$(command -v ffprobe)
    else
      echo "Warning: ffprobe not found, some operations may fail."
      FFPROBE_BIN=""
    fi
  fi
  export FFPROBE_BIN

  return 0
}
