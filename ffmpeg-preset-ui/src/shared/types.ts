import { type Summary, type ParseOptions } from '../main/parser';

export type TaskOptions = {
  need_std_output?: boolean;
};

export type StartParsePayload = {
  options: ParseOptions;
  taskOptions?: TaskOptions;
};

export type StartParseResult = {
  started: boolean;
  id?: string;
};

export type ParseEventData = {
  event: 'started' | 'startParseFile' | 'parseFileSuccess' | 'parseFileFailed' | 'stdOutput' | 'percentProgress' | 'stdOutput' | 'finished';
  data: {
    id: string;
    source?: string;
    target?: string;
    type?: 'stdout' | 'stderr';
    content?: string;
    percent?: number;
    success?: boolean;
    summaries?: Summary[];
  };
};

export interface FFmpegPresetAPI {
  requestMaximize: () => Promise<void>;
  requestMinimize: () => Promise<void>;
  requestClose: () => Promise<void>;

  chooseFile: (options: {
    type: string;
    defaultPath?: string;
  }) => Promise<string | string[] | null>;
  getFilePath: (file: File) => string;
  showItemInFolder: (path: string) => Promise<void>;

  startParse(options: ParseOptions, taskOptions?: TaskOptions): Promise<StartParseResult>;
  terminateParse(taskId: string): Promise<boolean>;
  onParseEvent(callback: (data: ParseEventData) => void): () => void;
}
