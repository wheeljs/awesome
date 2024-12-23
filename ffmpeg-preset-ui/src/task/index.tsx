import { createSignal } from 'solid-js';

import { type Task, type TaskEvent } from './types';
import { TaskContext } from './context';
import { CreateTask } from './CreateTask';
export { CreateTask };
import { createParseTask } from './service';

function TaskComponent() {
  const [taskId, setTaskId] = createSignal('');
  const [parsing, setParsing] = createSignal(false);
  const [percent, setPercent] = createSignal(0);
  const [taskFinishedSignal, setTaskFinishedSignal] = createSignal(0);

  const onCreate = (createdTask: Task) => {
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
          setParsing(false);
          setPercent(0);
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
      </div>
    </TaskContext.Provider>
  )
}

export { TaskComponent as Task };
