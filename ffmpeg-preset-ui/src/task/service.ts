import { type Task, type TaskEvent } from './types';
import { invoke, Channel } from '@tauri-apps/api/core';
import { pick } from 'lodash-es';

interface NewTask extends Omit<Task, 'files'> {
  files?: string[][];
}

type CreateTaskResult = {
  pending: Promise<void>;
  channel: Channel<TaskEvent>;
};

export function createParseTask(task: Task): CreateTaskResult {
  const { files, ...newTask } = task;

  if (Array.isArray(task.files)) {
    (newTask as NewTask).files = task.files.map<string[]>(
      (file) => ([file.source, file.target].filter((x) => x) as string[])
    );
  }

  const channel = new Channel<TaskEvent>();
  const pending = invoke<void>('start_parse', {
    options: newTask,
    channel,
  });

  return {
    pending,
    channel,
  };
}

type LatestTaskConfig = Pick<Task, 'command' | 'bashFile' | 'gpu' | 'useResize' | 'resize' | 'bitrate'>;
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
