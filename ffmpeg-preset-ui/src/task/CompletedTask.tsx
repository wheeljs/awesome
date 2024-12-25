import { For, Show } from 'solid-js';

import { type CompletedTask } from './types';

import './CompletedTask.scss';

export type CompletedTaskProps = {
  task: CompletedTask;
};

export function CompletedTaskComponent(props: CompletedTaskProps) {
  return (
    <div class="completed-task">
      Task({props.task.id}) {props.task.status === 'completed' ? 'finished' : 'terminated'}:<br/>
      Parsed files:
      <ul>
        <For each={props.task.files}>
          {(item) => (
            <li>{item.source}<Show when={item.target}> &gt;&gt; {item.target}</Show></li>
          )}
        </For>
      </ul>
    </div>
  );
}
