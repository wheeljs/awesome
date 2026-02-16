import { For, Show } from 'solid-js';

import { type TaskFile, type Task } from './types';
import { RevealFile } from '../components/RevealFile';

import './CompletedTask.scss';

export type CompletedTaskProps = {
  task: Task;
};

type CompletedFileProps = {
  file: TaskFile;
};

function CompletedTaskFile(props: CompletedFileProps) {
  const item = () => props.file;

  const target = (item: TaskFile) => {
    return item.normalizedTarget ?? item.target;
  };

  return (
    <>
      <RevealFile file={item().normalizedSource} />
      <Show when={item().sourceSize}> ({item().sourceSize})</Show>
      <Show when={target(item())}>
        {' '}
        &gt;&gt; <RevealFile file={target(item())!} />
        <Show when={item().targetSize}> ({item().targetSize})</Show>
      </Show>
      <Show when={item().reduceSize}> -{item().reduceSize}</Show>
    </>
  );
}

export function CompletedTaskComponent(props: CompletedTaskProps) {
  return (
    <div class="completed-task">
      Task({props.task.id}){' '}
      {props.task.status === 'completed' ? 'finished' : 'terminated'}:<br />
      Parsed files:
      <ul>
        <For each={props.task.files}>
          {(item) => (
            <li>
              <CompletedTaskFile file={item} />
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}
