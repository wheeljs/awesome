import { pick } from 'lodash-es';
import { fromEventPattern, share, type Observable } from 'rxjs';

import type { NewTask, TaskEvent } from './types';
import type { TaskOptions, ParseEventData } from '../../shared/types';

interface NewTaskInService extends Omit<NewTask, 'files'> {
  files: string[][];
}

type CreateTaskResult = {
  pending: Promise<any>;
  channel: { onmessage: (ev: TaskEvent) => void; close?: () => void };
};

let parseEvent$: Observable<ParseEventData>;
export function subscribeParseEvent() {
  if (!parseEvent$) {
    parseEvent$ = fromEventPattern<ParseEventData>(
      (handler) => {
        return window.electronAPI.onParseEvent(handler);
      },
      (_, unsubscribe) => unsubscribe(),
    ).pipe(share());
  }

  return parseEvent$;
}

export function init() {
  return {
    parseEvent$: subscribeParseEvent()
  };
}

export function createParseTask(task: NewTask, options: TaskOptions): CreateTaskResult {
  const { files, ...newTask } = task;
  const newTaskInService = newTask as NewTaskInService;

  if (Array.isArray(task.files)) {
    newTaskInService.files = task.files.map<string[]>(
      (file) => ([file.source, file.target] as string[])
    );
  } else {
    newTaskInService.files = [];
  }

  // Call Electron main to start parse and subscribe to events via preload bridge
  const pending = window.electronAPI.startParse(newTaskInService, options);

  const channel = {
    onmessage: (_: any) => {},
    _unsub: null as any,
  } as any;

  channel._unsub = window.electronAPI.onParseEvent((evt) => {
    channel.onmessage({ event: evt.event, data: evt.data });
  });

  channel.close = () => channel._unsub?.();

  return { pending, channel };
}

export function terminateParseTask({ taskId }: { taskId: string }): Promise<boolean> {
  return window.electronAPI.terminateParse(taskId);
}

type LatestTaskConfig = Pick<NewTask, 'command' | 'bashFile' | 'gpu' | 'useResize' | 'resize' | 'bitrate'>;
type LatestConfig = {
  task?: LatestTaskConfig;
  taskOptions?: TaskOptions;
};
const LatestTaskConfigStorageKey = 'latestTaskConfig';
const TaskOptionsStorageKey = 'latestTaskOptions';

export async function loadLatestConfig(): Promise<LatestConfig> {
  const [taskResult, optionsResult] = await Promise.allSettled([
    new Promise<LatestTaskConfig>((resolve) => {
      const latestTaskConfigStr = localStorage[LatestTaskConfigStorageKey];
      try {
        resolve(JSON.parse(latestTaskConfigStr));
      } catch {
        resolve(undefined);
      }
    }),
    new Promise<TaskOptions>((resolve) => {
      const taskOptionsStr = localStorage[TaskOptionsStorageKey];
      try {
        resolve(JSON.parse(taskOptionsStr));
      } catch {
        resolve(undefined);
      }
    }),
  ]);

  return {
    task: taskResult.status === 'fulfilled' ? taskResult.value : undefined,
    taskOptions: optionsResult.status === 'fulfilled' ? optionsResult.value : undefined,
  };
}

export function saveLatestTaskConfig(config: LatestTaskConfig, taskOptions: TaskOptions): Promise<void> {
  return new Promise((resolve) => {
    localStorage[LatestTaskConfigStorageKey] = JSON.stringify(pick(config, 'command', 'bashFile', 'gpu', 'useResize', 'resize', 'bitrate'));
    localStorage[TaskOptionsStorageKey] = JSON.stringify(taskOptions);
    resolve();
  });
}
