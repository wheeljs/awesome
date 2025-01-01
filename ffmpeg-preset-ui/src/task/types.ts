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

export type Task = NewTask & {
  id: string;
  status: 'parsing' | 'completed' | 'terminated';
};

interface TaskEventMap {
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
  };
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
