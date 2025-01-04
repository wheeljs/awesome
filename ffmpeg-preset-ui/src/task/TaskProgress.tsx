import { createSignal, createMemo } from 'solid-js';
import { groupBy } from 'lodash-es';

import { Modal } from '../components/Modal';
import { terminateParseTask } from './service';
import { type RunningTask } from './types';

import './TaskProgress.scss';

export type TaskProgressProps = {
  runningTask: RunningTask;
};

export function TaskProgress(props: TaskProgressProps) {
  const [showConfirmModal, setShowConfirmModal] = createSignal(false);
  const [showTerminateFailedModal, setShowTerminateFailedModal] = createSignal(false);
  const [terminating, setTerminating] = createSignal(false);

  const files = createMemo(() => {
    const groupedFiles = groupBy(props.runningTask.task?.files, x => x.status);
    return {
      statusFiles: groupedFiles,
      parsingFile: props.runningTask.task?.files?.find?.((x) => x.status === 'parsing'),
    };
  });

  const parsingStr = () => {
    const { statusFiles, parsingFile } = files();
    if (parsingFile) {
      let parsingStr = `Parsing ${parsingFile.source}`;
      if (statusFiles) {
        parsingStr += `(${(statusFiles.completed?.length ?? 0) + 1}/${props.runningTask.task?.files.length})`;
      }

      return parsingStr;
    }

    return '';
  };

  const handleStopTask = async (confirmed = false) => {
    if (!confirmed) {
      return setShowConfirmModal(true);
    }
    setShowConfirmModal(false);

    if (terminating()) {
      return;
    }
    setTerminating(true);
    try {
      await terminateParseTask({
        taskId: props.runningTask.task!.id,
      });
    } catch {
      setTerminating(false);
      setShowTerminateFailedModal(true);
    }
  };

  return (
    <>
      <div class="task-progress">
        <div class="progress-indicator">
          <div class="progress-indicator progress-indicator-wrapper">
            <span class="progress-indicator-text">{parsingStr()}</span>
            <span class="progress-indicator-bar" data-text={parsingStr()} style={{ width: `${props.runningTask.percent}%` }}></span>
          </div>
        </div>
        <button class="task-terminate-btn" disabled={terminating()} onClick={() => handleStopTask()}>Terminate</button>
      </div>
      <Modal
        show={showConfirmModal()}
        title="Terminate Confirm"
        showCancelButton
        onOk={() => handleStopTask(true)}
        onCancel={() => setShowConfirmModal(false)}
      >{() => (
        <div>You have running parsing task, terminate parsing will leave target file in middle state. Are you sure to TERMINATE parsing?</div>
      )}</Modal>
      <Modal
        show={showTerminateFailedModal()}
        title="Terminate Failed"
        onOk={() => setShowTerminateFailedModal(false)}
      >{() => (
        <div>Terminate task failed, please retry later.</div>
      )}</Modal>
    </>
  );
}
