import { For, Show, useContext, createEffect, onMount, onCleanup } from 'solid-js';
import { createStore, produce, unwrap } from 'solid-js/store';
import { type UnlistenFn } from '@tauri-apps/api/event';
import { Fa } from 'solid-fa';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { faCircleQuestion } from '@fortawesome/free-regular-svg-icons';
import { uniqBy, groupBy, cloneDeep } from 'lodash-es';

import { tauriDragAndDrop } from '../reusables/dragAndDrop';
import type { Task, TaskFile } from './types';
import { TaskContext, TaskFileContext } from './context';
import { loadLatestTaskConfig, saveLatestTaskConfig } from './service';
import { BrowseInput } from '../components/BrowseInput';
import { TargetInput } from './components/TargetInput';
import './CreateTask.scss';

export type CreateTaskProps = {
  loading?: boolean;
  onCreate: (createTask: Task) => void;
};

const validateFileItem = (file: TaskFile) => file.source?.length > 0;

export function CreateTask(props: CreateTaskProps) {
  const IdPrefix = 'create-task-';
  const id = (part: string) => `${IdPrefix}${part}`;

  const [newTask, setNewTask] = createStore<Task>({
    command: '',
    bashFile: '',
    gpu: true,
    useResize: false,
    resize: '',
    bitrate: '1.5M',
    files: [
      { source: '', target: ''},
    ],
  });

  onMount(async () => {
    const config = await loadLatestTaskConfig();
    if (config) {
      setNewTask((draft) => ({
        ...draft,
        ...config,
      }));
    }
  });

  const updator = <K extends keyof Task>(key: K, value: Task[K]) => {
    setNewTask(
      produce((draft) => {
        draft[key] = value;
      })
    );
  };

  const updateFile = <K extends keyof TaskFile>(index: number, key: K, value: TaskFile[K]) => {
    setNewTask('files', index, produce((draft) => {
      draft[key] = value;
    }));
  };

  const handleAddFileRow = () => {
    setNewTask('files', (draft) => [
      ...draft,
      { source: '', target: '' },
    ]);
  };

  const handleDeleteFileRow = (index: number) => {
    setNewTask('files', (draft) => draft.filter((_, idx) => idx !== index));
  };

  const handleChooseFile = (index: number, result: string | string[] | null) => {
    if (!result) {
      return;
    }

    if (!Array.isArray(result)) {
      updateFile(index, 'source', result);
    } else if (result.length === 1) {
      updateFile(index, 'source', result[0]);
    } else if (index === 0) {
      setNewTask('files', (draft) => {
        const newTaskFiles: TaskFile[] = uniqBy(
          [
            ...draft,
            ...result.map((x) => ({ source: x })),
          ].filter(validateFileItem),
          'source',
        );

        return newTaskFiles;
      });
    }
  };

  let unlisten: UnlistenFn;
  tauriDragAndDrop({
    onDrop: (event) => {
      setNewTask('files', (draft) => uniqBy([
        ...draft,
        ...event.paths.map((x) => ({
          source: x,
        })),
      ], 'source'));
    },
  }).then((fn) => unlisten = fn);

  onCleanup(() => {
    unlisten?.();
  });

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();

    const groupedFiles = groupBy(newTask.files, (x) => validateFileItem(x) ? 'valid' : 'invalid');
    if (!groupedFiles.valid?.length) {
      return;
    }

    if (groupedFiles.invalid?.length > 0) {
      setNewTask('files', (draft) => draft.filter(validateFileItem));
    }

    const createdTask: Task = cloneDeep(unwrap(newTask));
    if (!createdTask.useResize) {
      delete createdTask.resize;
    }

    saveLatestTaskConfig(createdTask);
    props.onCreate?.(createdTask);
  };

  const context = useContext(TaskContext);
  createEffect(() => {
    if (context.parseFinishedSignal() > 0) {
      setNewTask('files', [
        { source: '', target: ''},
      ]);
    }
  });

  const taskFileContext = {
    getAboveTarget: (index: number) => {
      const aboveFileItem = newTask.files[index - 1];
      if (!aboveFileItem) {
        return '';
      }

      return aboveFileItem.target ?? '';
    },
  };

  const hasValidFile = () => newTask.files.filter(validateFileItem).length > 0;

  return (
    <form class="create-task-form" onSubmit={handleSubmit}>
      <fieldset disabled={props.loading}>
        <div class="create-task-form__command">
          <label for={id('command')}>Executor:</label>
          <BrowseInput
            id={id('command')}
            type="text"
            value={newTask.command}
            placeholder="/path/to/bash"
            fileBrowseProps={{title: 'Choose command like bash.exe'}}
            onChange={(value) => updator('command', value) }
            onChooseFile={(value) => updator('command', value as string) }
          />
        </div>
        <div class="create-task-form__bash-file">
          <label for={id('file')}>File:</label>
          <BrowseInput
            id={id('file')}
            type="text"
            value={newTask.bashFile}
            placeholder="/path/to/low-video.bash(close to ffmpeg.exe)"
            fileBrowseProps={{
              title: 'Choose low-video.bash',
              filters: [
                {extensions: ['bash'], name: 'low-video.bash'}
              ],
            }}
            onChange={(value) => updator('bashFile', value)}
            onChooseFile={(value) => updator('command', value as string) }
          />
        </div>
        <div class="create-task-form__options">
          <div class="create-task-form__gpu">
            <input
              id={id('gpu')}
              type="checkbox"
              checked={newTask.gpu}
              onChange={(e) => updator('gpu', e.target.checked)}
            />
            <label for={id('gpu')}>
              GPU
            </label>
          </div>
          <div class="create-task-form__resize">
            <input
              id={id('use-resize')}
              type="checkbox"
              checked={newTask.useResize}
              onChange={(e) => updator('useResize', e.target.checked)}
            />
            <label for={id('use-resize')}>
              Resize:
            </label>
            <input
              id={id('resize')}
              type="text"
              disabled={!newTask.useResize}
              value={newTask.resize}
              onChange={(e) => updator('resize', e.target.value)}
            />
          </div>
          <div class="create-task-form__bitrate">
            <label for={id('bitrate')}>Bitrate:</label>
            <input
              id={id('bitrate')}
              type="text"
              value={newTask.bitrate}
              onChange={(e) => updator('bitrate', e.target.value)}
            />
          </div>
        </div>
        <TaskFileContext.Provider value={taskFileContext}>
          <div class="sunken-panel create-task-form__files">
            <table>
              <thead>
                <tr>
                  <th class="create-task-form__files__operation-column"></th>
                  <th>Source</th>
                  <th title="If you:
Leave it blank: Target will be close to Source but ends with &quot;.low.{extension}&quot;
Choose a directory: Target will be destinate to choosed directory with &quot;.low.{extension}&quot;
Choose a directory and fill file name: Target will be destinate to choosed directory with your specified name">Target(Optional)<Fa icon={faCircleQuestion} /></th>
                </tr>
              </thead>
              <tbody>
                <For each={newTask.files}>
                  {(item, index) => {
                    return (<tr>
                      <td class="create-task-form__files__operation-column"><Show when={newTask.files.length > 1}><button
                        type="button"
                        class="only-icon"
                        onClick={() => handleDeleteFileRow(index())}
                      ><Fa icon={faXmark} /></button></Show></td>
                      <td><BrowseInput
                        type="text"
                        value={item.source}
                        fileBrowseProps={{
                          title: 'Choose video(s)',
                          multiple: true,
                          button: {
                            mode: 'icon',
                          },
                        }}
                        onChooseFile={(e) => handleChooseFile(index(), e)}
                        onChange={(value) => updateFile(index(), 'source', value)}
                      /></td>
                      <td><TargetInput
                        index={index()}
                        source={item.source}
                        type="text"
                        value={item.target}
                        onChange={(value) => updateFile(index(), 'target', value)}
                      /></td>
                    </tr>);
                  }}
                </For>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2">
                    <button type="button" onClick={handleAddFileRow}>Add</button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </TaskFileContext.Provider>
        <button type="submit" disabled={!hasValidFile()}>Parse</button>
      </fieldset>
    </form>
  );
}
