#!/bin/bash

# 用户自定义参数
TARGET_DIR="/i/相声Audio" # 输出目录
FFMPEG_BIN="$(which ffmpeg)" # 自动查找 ffmpeg 路径（也可手动填写）

# 也可手动指定，比如：
# FFMPEG_BIN="/usr/local/bin/ffmpeg"
# FFMPEG_BIN="/c/ffmpeg/bin/ffmpeg.exe"  # Windows Git Bash 示例

# 检查 ffmpeg 是否存在
if [[ ! -x "$FFMPEG_BIN" ]]; then
  echo "❌ 未找到 ffmpeg 可执行文件，请检查 FFMPEG_BIN 设置"
  exit 1
fi

# 创建输出目录
# mkdir -p "$TARGET_DIR"

# 遍历所有 mp4 文件
for file in *.mp4; do
    [ -e "$file" ] || continue  # 跳过无匹配文件

    base_name="${file%.mp4}"
    output_path="$TARGET_DIR/${base_name}.mp3"

    # 如果目标文件已存在，跳过
    if [[ -f "$output_path" ]]; then
        echo "✅ 已存在，跳过：$output_path"
        continue
    fi

    echo "🎧 正在处理：$file → $output_path"

    "$FFMPEG_BIN" -i "$file" -vn \
      -af "highpass=f=80, lowpass=f=7500, dynaudnorm, equalizer=f=300:t=q:w=2:g=5" \
      -acodec libmp3lame -q:a 2 "$output_path"

    # 检查命令是否成功
    if [[ $? -ne 0 ]]; then
        echo "❌ 处理失败：$file"
        exit 1
    fi
done

echo "✅ 全部处理完成"
