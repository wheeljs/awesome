import path from 'path';

export type ParseOptions = {
  command: string;
  bashFile: string;
  gpu?: boolean;
  resize?: string | null;
  bitrate?: string | null;
  files: string[][];
};

export type ParseCommand = {
  command: string;
  args: string[];
};

const NORMALIZE_REGEX = /([ ()&])/g;
const WINDOWS_STYLE_PATH_REGEX = /^.*:\\/;

function normalizeUnixPath(path: string) {
  return path.replace(NORMALIZE_REGEX, "\\$1");
}

function ensureUnixPath(path: string) {
  // detect Windows style like C:\path\to
  if (WINDOWS_STYLE_PATH_REGEX.test(path)) {
    const [driver, tail] = path.split(':\\');
    const tailForward = tail.replace(/\\\\/g, '/').replace(/\\/g, '/');
    return `/${driver.toLowerCase()}/${normalizeUnixPath(tailForward)}`;
  }

  return normalizeUnixPath(path);
}

function ensureBashFile(bashFile: string): string[] {
  try {
    const parent = path.dirname(bashFile);
    const fileName = path.basename(bashFile);
    const out: string[] = [];
    if (parent && parent !== '.' && parent !== '/') {
      out.push(`cd ${ensureUnixPath(parent)} &&`);
    }
    out.push(fileName);
    return out;
  } catch (e) {
    return [bashFile];
  }
}

export function buildParseCommand(options: ParseOptions): ParseCommand {
  const bashFileArgs = ensureBashFile(options.bashFile);

  if (options.gpu) {
    bashFileArgs.push('--gpu');
  }
  if (options.resize) {
    bashFileArgs.push('--resize');
    bashFileArgs.push(options.resize);
  }
  if (options.bitrate) {
    bashFileArgs.push('--bitrate');
    bashFileArgs.push(options.bitrate);
  }

  const filesArgs = options.files.map((f) => {
    const source = Array.isArray(f) ? f[0] : (f as any)[0];
    const target = Array.isArray(f) && (f as any).length > 1 ? (f as any)[1] : null;
    const ensuredSource = ensureUnixPath(source as string);
    if (target) {
      const ensuredTarget = ensureUnixPath(target as string);
      return `${ensuredSource}:${ensuredTarget}`;
    }
    return ensuredSource;
  });

  bashFileArgs.push(...filesArgs);

  return {
    command: options.command,
    args: bashFileArgs,
  };
}

function timeStrToMilliseconds(timeStr: string): number | null {
  // Accept formats like HH:MM:SS[.xxx]
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (!match) {
    return null;
  }
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const fraction = match[4] ? match[4].padEnd(3, '0').slice(0, 3) : '000';
  const ms = hours * 3600 * 1000 + minutes * 60 * 1000 + seconds * 1000 + parseInt(fraction, 10);
  return ms;
}

const DURATION_LINE_REGEX = /Duration:(.*),\sstart/;
export function tryDurationLine(line: string): number | null {
  const match = DURATION_LINE_REGEX.exec(line);
  if (!match) {
    return null;
  }
  const durationStr = match[1].trim();
  return timeStrToMilliseconds(durationStr);
}

const PERCENTAGE_LINE_REGEX = /time=(.*)\sbitrate=/;
export function tryPercentLine(line: string): number | null {
  const match = PERCENTAGE_LINE_REGEX.exec(line);
  if (!match) {
    return null;
  }
  const timeStr = match[1].trim();
  return timeStrToMilliseconds(timeStr);
}

const CONVERTING_LINE_REGEX = /Convert(?<status>\w+?)(?: (?<result>\w+):)? (?<input_path>.+?) ===> (?<output_path>.+)/;
export type ConvertStatusLine =
  | { type: 'started'; input: string; output: string }
  | { type: 'succeed'; input: string; output: string }
  | { type: 'failed'; input: string; output: string };

export function tryConvertingLine(line: string): ConvertStatusLine | null {
  const match = CONVERTING_LINE_REGEX.exec(line);
  if (!match?.groups) {
    return null;
  }

  const status = match.groups.status;
  const result = match.groups.result;
  const input = match.groups.input_path;
  const output = match.groups.output_path;
  if (status === 'ing') {
    return {
      type: 'started',
      input,
      output,
    };
  }
  
  if (status === 'ed') {
    if (result === 'success') {
      return {
        type: 'succeed',
        input,
        output,
      };
    }

    if (result === 'failed') {
      return {
        type: 'failed',
        input,
        output,
      };
    }
  }
  return null;
}

const SUMMARY_LINE_REG = /Input:\s*(?<source>[^\n,]+),\s*Size:\s*(?<source_size>[\d.]+\s*MB)\s*===>\s*Output:\s*(?<target>[^\n,]+),\s*Size:\s*(?<target_size>[\d.]+\s*MB),\s*(?<reduce_size>[\d.]+\s*MB)\s*smaller\s*than\s*origin/;
export type Summary = {
  source: string;
  sourceSize: string;
  target: string;
  targetSize: string;
  reduceSize: string;
};

export function trySummaryLine(line: string): Summary | null {
  const match = SUMMARY_LINE_REG.exec(line);
  if (!match?.groups) {
    return null;
  }

  return {
    source: match.groups.source.trim(),
    sourceSize: match.groups.source_size.trim(),
    target: match.groups.target.trim(),
    targetSize: match.groups.target_size.trim(),
    reduceSize: match.groups.reduce_size.trim(),
  };
}
