import { Show, createSignal } from 'solid-js';
import { createStore, produce } from 'solid-js/store';

import type { NewTask, TaskFile, TaskEvent, TaskEventMap, RunningTask } from './types';
import { TaskContext } from './context';
import { CreateTask } from './CreateTask';
export { CreateTask };
import { CompletedTaskComponent } from './CompletedTask';
export { CompletedTaskComponent };
import { TaskList } from './TaskList';
export { TaskList };
import { createParseTask } from './service';
import { ensureUnixPath } from '../utils/utils';
import { TaskOptions } from '../../shared/types';

import { TaskProgress } from './TaskProgress';

import './index.scss';

const ParseFileEventFileStatusMapping: Record<
  keyof Pick<TaskEventMap, 'startParseFile' | 'parseFileSuccess' | 'parseFileFailed'>,
  TaskFile['status']
> = {
  'startParseFile': 'parsing',
  'parseFileSuccess': 'completed',
  'parseFileFailed': 'failed',
};

function TaskComponent() {
  const [task, setTask] = createStore<RunningTask>({
    task: null,
    parsing: false,
    percent: 0,
  });

  const [rawTask, setRawTask] = createSignal(false);
  const [taskFinishedSignal, setTaskFinishedSignal] = createSignal(0);

  const onCreate = (createdTask: NewTask, taskOptions: TaskOptions) => {
    const { channel } = createParseTask(createdTask, taskOptions);

    channel.onmessage = (event) => {
      if (!task.task) {
        setTask(produce((draft) => {
          draft.task = {
            id: event.data.id,
            status: 'parsing',
            ...createdTask,
            files: createdTask.files.map((x) => ({
              ...x,
              normalizedSource: ensureUnixPath(x.source),
              status: 'not-started',
            })),
          };
          draft.parsing = true;
        }));
      }
      if (rawTask() !== taskOptions.raw) {
        setRawTask(taskOptions.raw);
      }

      switch (event.event) {
        case 'startParseFile':
        case 'parseFileSuccess':
        case 'parseFileFailed':
          {
            const evt = event as TaskEvent<'startParseFile'>;
            const parsingFile = task.task!.files.find((x) => x.normalizedSource === evt.data.source);
            if (parsingFile) {
              setTask(produce((draft) => {
                const parsingFile = draft.task!.files.find((x) => x.normalizedSource === evt.data.source)!;
                if (evt.data.target) {
                  parsingFile.normalizedTarget = evt.data.target;
                }
                parsingFile.status = ParseFileEventFileStatusMapping[evt.event];
              }));
            }
          }

          break;
        case 'percentProgress':
          setTask('percent', (event as TaskEvent<'percentProgress'>).data.percent);
          break;
        case 'finished':
          {
            const evt = event as TaskEvent<'finished'>;
  
            setTask({
              task: null,
              parsing: false,
              percent: 0,
            });
            if (evt.data.success) {
              setTaskFinishedSignal(Date.now());
            }
          }
          break;
      }
    };
  }

  const ctx = {
    parseFinishedSignal: taskFinishedSignal,
  };

  return (
    <TaskContext.Provider value={ctx}>
      <div>
        <CreateTask loading={task.parsing} onCreate={onCreate} />
        <Show when={task.parsing}>
          <Show when={!rawTask} fallback={<div class="task-index__raw-tips">You can see progress from opened shell.</div>}>
            <TaskProgress runningTask={task} />
          </Show>
        </Show>
        <TaskList />
      </div>
    </TaskContext.Provider>
  );
}

export { TaskComponent as Task };
