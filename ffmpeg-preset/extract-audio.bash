#!/bin/bash

# 用户自定义参数
TARGET_DIR="/i/相声Audio" # 输出目录

# 解析脚本真实路径（跟随符号链接），得到脚本所在目录 SCRIPT_DIR
SCRIPT_SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SCRIPT_SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SCRIPT_SOURCE")" >/dev/null 2>&1 && pwd)"
  SCRIPT_SOURCE="$(readlink "$SCRIPT_SOURCE")"
  # 如果 readlink 返回的是相对路径，则补回原目录
  [[ "$SCRIPT_SOURCE" != /* ]] && SCRIPT_SOURCE="$DIR/$SCRIPT_SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SCRIPT_SOURCE")" >/dev/null 2>&1 && pwd)"

# 使用真实脚本目录去引用公共查找脚本
source "$SCRIPT_DIR/find-ffmpeg.bash"
if ! find_ffmpeg; then
  echo "❌ 未找到 ffmpeg 可执行文件，请检查 PATH 或设置 FFMPEG_PATH 环境变量"
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
