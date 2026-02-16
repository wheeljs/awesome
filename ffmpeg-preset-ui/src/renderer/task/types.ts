export type NewTaskFile = {
  source: string;
  target?: string;
};

export type NewTask = {
  command: string;
  bashFile: string;
  gpu: boolean;
  useResize?: boolean;
  resize?: string;
  bitrate: string;
  files: NewTaskFile[];
};

export type TaskFile = NewTaskFile & {
  normalizedSource: string;
  sourceSize?: string;
  normalizedTarget?: string;
  targetSize?: string;
  status: 'not-started' | 'parsing' | 'completed' | 'failed';
  reduceSize?: string;
};

export type Task = Omit<NewTask, 'files'> & {
  id: string;
  files: TaskFile[];
  status: 'parsing' | 'completed' | 'terminated';
};

type ParseFileEventPayload = {
  id: string;
  source: string;
  target: string;
};

export type Summary = {
  source: string;
  sourceSize: string;
  target: string;
  targetSize: string;
  reduceSize: string;
};

export interface TaskEventMap {
  'started': {
    id: string;
  };
  'stdOutput': {
    id: string;
    type: 'stdout' | 'stderr';
    content: string;
  };
  'percentProgress': {
    id: string;
    percent: number;
  };
  'finished': {
    id: string;
    success: boolean;
    summaries: Summary[];
  };
  'startParseFile': ParseFileEventPayload;
  'parseFileSuccess': ParseFileEventPayload;
  'parseFileFailed': ParseFileEventPayload;
}

export interface TaskEvent<K extends keyof TaskEventMap = keyof TaskEventMap> {
  event: K;
  data: TaskEventMap[K];
}

export type RunningTask = {
  task: Task | null;
  parsing: boolean;
  percent: number;
};
