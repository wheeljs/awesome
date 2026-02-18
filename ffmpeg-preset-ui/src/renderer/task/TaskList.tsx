import { from, For } from 'solid-js';
import { filter, scan } from 'rxjs';

import { init } from './service';
import { CompletedTaskComponent } from './CompletedTask';

export function TaskList() {
  const taskList = from(
    init().parseEvent$
      .pipe(
        filter((event) => event.event === 'finished'),
        scan((prev, event) => {
          const { summaries, ...rest } = event.data;
          return [
            {
              ...rest,
              files: summaries,
              status: event.data.success ? 'completed' : 'terminated',
            },
            ...prev,
          ];
        }, []),
      ),
  );

  return (
    <For each={taskList()}>
      {(item) => (
        <CompletedTaskComponent task={item} />
      )}
    </For>
  );
}
