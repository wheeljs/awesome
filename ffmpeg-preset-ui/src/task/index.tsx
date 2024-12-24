import { For, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';

import { type Task, type TaskEvent, type CompletedTask } from './types';
import { TaskContext } from './context';
import { CreateTask } from './CreateTask';
export { CreateTask };
import { CompletedTaskComponent } from './CompletedTask';
export { CompletedTaskComponent };
import { createParseTask } from './service';

function TaskComponent() {
  const [completedTasks, setCompletedTasks] = createStore<CompletedTask[]>([]);

  const [parsing, setParsing] = createSignal(false);
  const [percent, setPercent] = createSignal(0);
  const [taskFinishedSignal, setTaskFinishedSignal] = createSignal(0);

  const onCreate = (createdTask: Task) => {
    let taskId: string;
    const { channel } = createParseTask(createdTask);

    channel.onmessage = (event) => {
      if (!taskId) {
        taskId = event.data.id;
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
          setParsing(false);
          setPercent(0);
          setCompletedTasks((draft) => [
            {
              ...createdTask,
              id: taskId,
            },
            ...draft,
          ]);
          setTaskFinishedSignal(Date.now());
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
        <div hidden={!parsing()} class="progress-indicator">
          <span class="progress-indicator-bar" style={{ width: `${percent()}%` }}></span>
        </div>
        <For each={completedTasks}>
          {(item) => (
            <CompletedTaskComponent task={item} />
          )}
        </For>
      </div>
    </TaskContext.Provider>
  )
}

export { TaskComponent as Task };
