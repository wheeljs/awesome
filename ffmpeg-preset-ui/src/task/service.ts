import { type Task, type TaskEvent } from './types';
import { invoke, Channel } from '@tauri-apps/api/core';

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
