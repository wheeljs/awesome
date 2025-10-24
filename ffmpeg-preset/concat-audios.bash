#!/bin/bash

# 用法: ./concat-audio.sh input1.mp3 input2.mp3 ... output.mp3

if [ "$#" -lt 3 ]; then
    echo "用法: $0 <input1.mp3> <input2.mp3> ... <output.mp3>"
    exit 1
fi

# 最后一个参数是输出文件名
output="${@: -1}"

# 其他的是输入文件
inputs=("${@:1:$#-1}")

# 创建 list 文件
list_file=$(mktemp)

# 将所有输入文件写入列表
for input in "${inputs[@]}"; do
    abs_path=$(cygpath -w "$(pwd)/$input")
    echo "file '$abs_path'" >> "$list_file"
done

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
  echo "未找到 ffmpeg，可在 PATH 中安装或设置 FFMPEG_PATH 环境变量"
  exit 1
fi

# 调用 ffmpeg 拼接
"$FFMPEG_BIN" -f concat -safe 0 -i "$list_file" -c copy "$output"

# 删除临时 list 文件
rm "$list_file"

echo "拼接完成: $output"

# 使用 explorer.exe 显示输出文件
explorer.exe /select,"$(cygpath -w "$(pwd)/$output")"
