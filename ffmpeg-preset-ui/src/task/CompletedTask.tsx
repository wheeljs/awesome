import { For, Show } from 'solid-js';

import { type TaskFile, type Task } from './types';

import './CompletedTask.scss';

export type CompletedTaskProps = {
  task: Task;
};

export function CompletedTaskComponent(props: CompletedTaskProps) {
  const target = (item: TaskFile) => {
    return item.normalizedTarget ?? item.target;
  }

  return (
    <div class="completed-task">
      Task({props.task.id}) {props.task.status === 'completed' ? 'finished' : 'terminated'}:<br/>
      Parsed files:
      <ul>
        <For each={props.task.files}>
          {(item) => (
            <li>{item.normalizedSource}<Show when={target(item)}> &gt;&gt; {target(item)}</Show></li>
          )}
        </For>
      </ul>
    </div>
  );
}
