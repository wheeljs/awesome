import { type NewTask, type TaskEvent } from './types';
import { invoke, Channel } from '@tauri-apps/api/core';
import { pick } from 'lodash-es';

interface NewTaskInService extends Omit<NewTask, 'files'> {
  files?: string[][];
}

type CreateTaskResult = {
  pending: Promise<void>;
  channel: Channel<TaskEvent>;
};

export function createParseTask(task: NewTask): CreateTaskResult {
  const { files, ...newTask } = task;

  if (Array.isArray(task.files)) {
    (newTask as NewTaskInService).files = task.files.map<string[]>(
      (file) => ([file.source, file.target].filter((x) => x) as string[])
    );
  }

  const channel = new Channel<TaskEvent>();
  const pending = invoke<void>('start_parse', {
    options: newTask,
    channel,
    taskOptions: {},
  });

  return {
    pending,
    channel,
  };
}

export function terminateParseTask({ taskId }: { taskId: string }): Promise<boolean> {
  return invoke<boolean>('terminate_parse', {
    taskId,
  });
}

type LatestTaskConfig = Pick<NewTask, 'command' | 'bashFile' | 'gpu' | 'useResize' | 'resize' | 'bitrate'>;
const LatestTaskConfigStorageKey = 'latestTaskConfig';

export function loadLatestTaskConfig(): Promise<LatestTaskConfig | undefined> {
  return new Promise((resolve) => {
    const latestTaskConfigStr = localStorage[LatestTaskConfigStorageKey];
    try {
      resolve(JSON.parse(latestTaskConfigStr));
    } catch {
      resolve(undefined);
    }
  });
}

export function saveLatestTaskConfig(config: LatestTaskConfig): Promise<void> {
  return new Promise((resolve) => {
    localStorage[LatestTaskConfigStorageKey] = JSON.stringify(pick(config, 'command', 'bashFile', 'gpu', 'useResize', 'resize', 'bitrate'));
    resolve();
  });
}
