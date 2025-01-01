import { For, Show, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';

import { type NewTask, type Task, type TaskEvent } from './types';
import { TaskContext } from './context';
import { CreateTask } from './CreateTask';
export { CreateTask };
import { CompletedTaskComponent } from './CompletedTask';
export { CompletedTaskComponent };
import { createParseTask } from './service';

import { TaskProgress } from './TaskProgress';

function TaskComponent() {
  const [completedTasks, setCompletedTasks] = createStore<Task[]>([]);

  const [taskId, setTaskId] = createSignal('');
  const [parsing, setParsing] = createSignal(false);
  const [percent, setPercent] = createSignal(0);
  const [taskFinishedSignal, setTaskFinishedSignal] = createSignal(0);

  const onCreate = (createdTask: NewTask) => {
    const { channel } = createParseTask(createdTask);

    channel.onmessage = (event) => {
      if (!taskId()) {
        setTaskId(event.data.id);
      }
      if (!parsing()) {
        setParsing(true);
      }

      switch (event.event) {
        case 'percentProgress':
          setPercent(
            (event as TaskEvent<'percentProgress'>).data.percent,
          );
          break;
        case 'finished':
          const evt = event as TaskEvent<'finished'>;

          setParsing(false);
          setPercent(0);
          setCompletedTasks((draft) => [
            {
              ...createdTask,
              id: taskId(),
              status: evt.data.success ? 'completed' : 'terminated',
            },
            ...draft,
          ]);
          setTaskId('');
          if (evt.data.success) {
            setTaskFinishedSignal(Date.now());
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
        <CreateTask loading={parsing()} onCreate={onCreate} />
        <Show when={parsing()}>
          <TaskProgress taskId={taskId()} progress={percent()} />
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
