#!/bin/bash

# 显示帮助信息
function show_help() {
  cat <<EOF
用法: $(basename "$0") [选项] 输入文件:输出文件 [输入文件2:输出文件2 ...]

选项:
  --gpu            使用 GPU 加速进行转换
  --bitrate        设置视频比特率，默认为 1.5M
  --output-dir     指定所有输出文件的目录
  -h               显示帮助信息

示例:
  $(basename "$0") --gpu --bitrate 2M video1.mp4:output1.mp4 video2.mp4:output2.mp4
  $(basename "$0") --gpu --output-dir /path/to/output video1.mp4 video2.mp4
EOF
}

# 获取文件大小（以字节为单位）
function get_file_size() {
  local file_path=$1
  stat -c %s "$file_path"
}

# 将文件大小转换为以 MB 为单位的格式
function human_readable_size() {
  local size=$1
  local mb_size=$(awk "BEGIN {printf \"%.2f\", $size / 1048576}")
  echo "$mb_size"
}

# 计算两个文件大小的差值（以 MB 为单位）
function calculate_size_difference() {
  local input_size=$1
  local output_size=$2
  local difference=$(awk "BEGIN {printf \"%.2f\", ($input_size - $output_size) / 1048576}")
  echo "$difference"
}

# 处理单个文件转换
function convert_file() {
  input_path=$1
  output_path=$2
  output_dir=$3

  # 如果 output_path 是目录，生成最终的输出路径
  if [ -d "$output_path" ]; then
    filename=$(basename "$input_path")
    output_path="$output_path/${filename%.*}.low.${filename##*.}"
    output_path=$(realpath "$output_path")  # 规范化输出路径
  elif [ -z "$output_path" ]; then
    # 如果output_path为空且指定了output_dir，则根据input_path生成默认的output_path
    if [ -n "$output_dir" ]; then
      filename=$(basename "$input_path")
      output_path="$output_dir/${filename%.*}.low.${filename##*.}"
      output_path=$(realpath "$output_path")  # 规范化输出路径
    else
      output_path="${input_path%.*}.low.${input_path##*.}"
    fi
  fi

  echo -ne "\033]0;Converting $input_path...\007"

  if [ "$use_gpu" = true ]; then
    ./ffmpeg.exe -vsync 0 -hwaccel cuvid -c:v h264_cuvid -i "$input_path" -c:a copy -c:v h264_nvenc -b:v $bitrate -vbr 1 -map_metadata 0 "$output_path"
  else
    # 调用ffmpeg.exe进行转换
    ./ffmpeg.exe -i "$input_path" -b:v $bitrate -map_metadata 0 "$output_path"
  fi

  # 检查 ffmpeg 是否执行成功
  if [ $? -eq 0 ]; then
    # 获取转换前后的文件大小
    input_size=$(get_file_size "$input_path")
    output_size=$(get_file_size "$output_path")

    # 将文件大小转换为人类可读的格式
    input_size_hr=$(human_readable_size $input_size)
    output_size_hr=$(human_readable_size $output_size)

    # 计算文件大小的差值
    size_difference=$(calculate_size_difference $input_size $output_size)

    # 打印转换信息
    echo "Converted:"
    echo "Input: $input_path, Size: $input_size_hr MB"
    echo "Output: $output_path, Size: $output_size_hr MB, $size_difference MB smaller than origin"
    echo ""
  else
    echo "Error converting $input_path to $output_path"
  fi
}

# 获取传入参数个数
args=$#

# 初始化变量
use_gpu=false
bitrate="1.5M"
output_dir=""

# 解析命令行参数
while getopts ":h-:" opt; do
  case $opt in
    gpu)
      use_gpu=true
      ;;
    bitrate)
      bitrate=$OPTARG
      ;;
    output-dir)
      output_dir=$OPTARG
      ;;
    h)
      show_help
      exit 0
      ;;
    -)
      if [[ $OPTARG == "gpu" ]]; then
        use_gpu=true
      elif [[ $OPTARG == "bitrate" ]]; then
        bitrate=${!OPTIND}
        OPTIND=$((OPTIND + 1))
      elif [[ $OPTARG == "output-dir" ]]; then
        output_dir=${!OPTIND}
        OPTIND=$((OPTIND + 1))
      fi
      ;;
    \?)
      echo "无效的选项: -$OPTARG" >&2
      show_help
      exit 1
      ;;
    :)
      echo "选项 -$OPTARG 需要参数." >&2
      show_help
      exit 1
      ;;
  esac
done

shift $((OPTIND - 1))

# 如果没有传入参数，提示用户并退出
if [ $args -eq 0 ]; then
  show_help
  exit 1
fi

# 判断ffmpeg.exe是否存在
if [ ! -f ./ffmpeg.exe ]; then
  echo "请确保当前目录下存在ffmpeg.exe"
  exit 1
fi

# 循环处理每个文件转换
for arg in "$@"; do
  IFS=':' read -r input_path output_path <<< "$arg"
  convert_file "$input_path" "$output_path" "$output_dir"
done
