#!/bin/bash

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
  echo "请确保系统 PATH 中包含 ffmpeg，或设置 FFMPEG_PATH 环境变量指向 ffmpeg 可执行文件或目录"
  exit 1
fi

# 显示帮助信息
function show_help() {
  cat <<EOF
用法: $(basename "$0") [选项] 输入文件:输出文件 [输入文件2:输出文件2 ...]

选项:
  --gpu            使用 GPU 加速进行转换
  --bitrate        设置视频比特率，默认为 1.5M
  --output-dir     指定所有输出文件的目录
  --resize         设置目标文件的分辨率，例如 1280x720
  --keep-m3u8      是否保留.m3u8文件格式，默认为false
  -h               显示帮助信息

示例:
  $(basename "$0") --gpu --bitrate 2M video1.mp4:output1.mp4 video2.mp4:output2.mp4
  $(basename "$0") --gpu --output-dir /path/to/output video1.mp4 video2.mp4
  $(basename "$0") --gpu --resize 1280x720 video1.mp4 video2.mp4
  $(basename "$0") --gpu  --resize 1440:-1 video1.mp4 video2.mp4
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

# 保存转换信息
declare -a conversion_info

# 同步文件的创建时间和修改时间
function sync_timestamps() {
  local input_path=$1
  local output_path=$2

  # 使用 touch 同步修改时间
  touch -r "$input_path" "$output_path"

  # 将 Linux 路径转换为 Windows 路径
  local win_input_path=$(cygpath -w "$input_path")
  local win_output_path=$(cygpath -w "$output_path")

  # 获取文件的时间戳
  local input_ctime=$(stat -c %W "$input_path")
  local input_mtime=$(stat -c %Y "$input_path")

  # 将 Unix 时间戳转换为 ISO8601 格式的字符串
  local utc_create_time=$(date -u -d "@$input_ctime" "+%Y-%m-%dT%H:%M:%SZ")
  local utc_modify_time=$(date -u -d "@$input_mtime" "+%Y-%m-%dT%H:%M:%SZ")

  # 构建 PowerShell 命令
  local powershell_command=$(printf '& ".\sync-time.ps1" %s %s' "$win_input_path" "$win_output_path")

  powershell -Command ""
}

# 处理单个文件转换
function convert_file() {
  local input_path=$1
  local output_path=$2
  local output_dir=$3
  local output_path_ready=false
  if [[ "$output_path" =~ \..+$ ]]; then
    output_path_ready=true
  fi

  local input_dir=$(dirname "$input_path")
  local filename=$(basename "$input_path")
  local extension="${filename##*.}"

  if [ -d "$output_dir" ]; then
    output_dir="${output_dir%\/}"
    # output_path不为空且仅有文件名（不包含/）
    if [[ -n "$output_path" && ! "$output_path" =~ [/\\] ]]; then
      output_path="$output_dir/$output_path"
      output_path_ready=true
    # output_path为空，使用output_dir作为目录
    elif [ -z "$output_path" ]; then
      output_path=$output_dir
    fi
  fi

  # 如果output_path仅有文件名部分（不包含/），不支持这种format
  if [[ -n "$output_path" && ! "$output_path" =~ [/\\] ]]; then
    echo "Unsupport format: $input_path:$output_path"
    return -1
  fi
  # 如果output_path为空，生成到input_path同样的目录
  if [ -z "$output_path" ]; then
    output_path="$input_dir"
  fi
  output_path="${output_path%\/}"

  if [ "$output_path_ready" == false ]; then
    # 如果是 .m3u8 文件且 keep_m3u8=false，则更改为 .mp4
    if [[ "$extension" == "m3u8" && "$keep_m3u8" == false ]]; then
      output_path="$output_path/${filename%.*}.low.mp4"
    else
      output_path="$output_path/${filename%.*}.low.$extension"
    fi
  fi
  output_path=$(realpath "$output_path")

  echo -ne "\033]0;Converting $input_path...\007"

  local ffmpeg_command="$FFMPEG_BIN -i \"$input_path\" -b:v $bitrate -map_metadata 0"

  # 检查输入文件是否为 WMV 格式
  local decoder="h264_cuvid"
  case "$input_path" in
    *.wmv)
      decoder="vc1_cuvid"
      ;;
  esac

  if [ "$use_gpu" = true ]; then
    ffmpeg_command="$FFMPEG_BIN -vsync 0 -hwaccel cuvid -c:v $decoder -i \"$input_path\" -c:a copy -c:v h264_nvenc -b:v $bitrate -vbr 1 -map_metadata 0"
  fi

  if [ -n "$resize" ]; then
    if [ "$use_gpu" = true ]; then
      ffmpeg_command="$ffmpeg_command -vf 'hwdownload,format=nv12,scale=$resize'"
    else
      ffmpeg_command="$ffmpeg_command -vf scale=$resize"
    fi
  fi

  ffmpeg_command="$ffmpeg_command \"$output_path\""

  echo ""
  echo "Converting $input_path ===> $output_path"

  eval $ffmpeg_command

  # 检查 ffmpeg 是否执行成功
  if [ $? -eq 0 ]; then
    echo "Converted success: $input_path ===> $output_path"

    # 获取转换前后的文件大小
    local input_size=$(get_file_size "$input_path")
    local output_size=$(get_file_size "$output_path")

    # 将文件大小转换为人类可读的格式
    local input_size_hr=$(human_readable_size $input_size)
    local output_size_hr=$(human_readable_size $output_size)

    # 计算文件大小的差值
    local size_difference=$(calculate_size_difference $input_size $output_size)

    # 同步输出文件的时间戳
    sync_timestamps "$input_path" "$output_path"

    # 保存转换信息
    conversion_info+=("Input: $input_path, Size: $input_size_hr MB  ===> Output: $output_path, Size: $output_size_hr MB, $size_difference MB smaller than origin")
    conversion_info+=("")
  else
    echo "Converted failed: $input_path ===> $output_path"
    # 保存转换失败信息
    conversion_info+=("Error converting $input_path to $output_path")
    conversion_info+=("")
  fi
}

# 获取传入参数个数
args=$#

# 初始化变量
use_gpu=false
bitrate="1.5M"
output_dir=""
resize=""
keep_m3u8=false # 新增的变量

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
    resize)
      resize=$OPTARG
      ;;
    keep-m3u8)
      keep_m3u8=$OPTARG
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
      elif [[ $OPTARG == "resize" ]]; then
        resize=${!OPTIND}
        OPTIND=$((OPTIND + 1))
      elif [[ $OPTARG == "keep-m3u8" ]]; then
        keep_m3u8=${!OPTIND}
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

# 循环处理每个文件转换
for arg in "$@"; do
  IFS=':' read -r input_path output_path <<< "$arg"
  convert_file "$input_path" "$output_path" "$output_dir"
done

# 输出所有文件的转换信息
echo "Conversion Summary:"
for info in "${conversion_info[@]}"; do
  echo "$info"
done
