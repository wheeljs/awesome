#!/bin/bash
# 公共 ffmpeg 查找逻辑
# 优先使用 PATH 中的 ffmpeg；如果找不到，再使用环境变量 FFMPEG_PATH（可以是可执行文件或目录）

function find_ffmpeg() {
  # 1) PATH 中的 ffmpeg 优先
  if command -v ffmpeg >/dev/null 2>&1; then
    FFMPEG_BIN=$(command -v ffmpeg)
    export FFMPEG_BIN
    return 0
  fi

  # 2) 使用环境变量 FFMPEG_PATH（支持目录或直接可执行路径）
  if [ -n "$FFMPEG_PATH" ]; then
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
      return 0
    fi
  fi

  return 1
}