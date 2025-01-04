import { For, Show, createSignal } from 'solid-js';
import { createStore, produce, unwrap } from 'solid-js/store';

import { type NewTask, type Task, type TaskFile, type TaskEvent, type TaskEventMap, type RunningTask } from './types';
import { TaskContext } from './context';
import { CreateTask } from './CreateTask';
export { CreateTask };
import { CompletedTaskComponent } from './CompletedTask';
export { CompletedTaskComponent };
import { createParseTask } from './service';
import { ensureUnixPath } from '../utils/utils';

import { TaskProgress } from './TaskProgress';

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

  const [completedTasks, setCompletedTasks] = createStore<Task[]>([]);
  const [taskFinishedSignal, setTaskFinishedSignal] = createSignal(0);

  const onCreate = (createdTask: NewTask) => {
    const { channel } = createParseTask(createdTask);

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

      switch (event.event) {
        case 'startParseFile':
        case 'parseFileSuccess':
        case 'parseFileFailed':
          {
            const evt = event as TaskEvent<'startParseFile'>;
            const parsingFile = task.task!.files.find((x) => x.normalizedSource === evt.data.source);
            if (parsingFile) {
              setTask(produce((draft) => {
                draft.task!.files
                  .find((x) => x.normalizedSource === evt.data.source)!
                  .status = ParseFileEventFileStatusMapping[evt.event];
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
  
            setCompletedTasks((draft) => [
              {
                ...unwrap(task.task!),
                status: evt.data.success ? 'completed' : 'terminated',
              },
              ...draft,
            ]);
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
          <TaskProgress runningTask={task} />
        </Show>
        <For each={completedTasks}>
          {(item) => (
            <CompletedTaskComponent task={item} />
          )}
        </For>
      </div>
    </TaskContext.Provider>
  );
}

export { TaskComponent as Task };
