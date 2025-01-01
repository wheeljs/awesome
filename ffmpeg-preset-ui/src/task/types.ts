export type TaskFile = {
  source: string;
  target?: string;
};

export type Task = {
  command: string;
  bashFile: string;
  gpu: boolean;
  useResize?: boolean;
  resize?: string;
  bitrate: string;
  files: TaskFile[];
};

export type CompletedTask = Task & {
  id: string;
  status: 'completed' | 'terminated';
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
