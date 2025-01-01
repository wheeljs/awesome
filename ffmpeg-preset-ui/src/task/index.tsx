import { For, Show, createSignal } from 'solid-js';
import { createStore, produce, unwrap } from 'solid-js/store';

import { type NewTask, type Task, type TaskEvent, type RunningTask } from './types';
import { TaskContext } from './context';
import { CreateTask } from './CreateTask';
export { CreateTask };
import { CompletedTaskComponent } from './CompletedTask';
export { CompletedTaskComponent };
import { createParseTask } from './service';

import { TaskProgress } from './TaskProgress';

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
          };
          draft.parsing = true;
        }));
      }

      switch (event.event) {
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
