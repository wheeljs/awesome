import { createSignal } from 'solid-js';

import { Modal } from '../components/Modal';
import { terminateParseTask } from './service';

import './TaskProgress.scss';

export type TaskProgressProps = {
  taskId: string,
  progress: number;
};

export function TaskProgress(props: TaskProgressProps) {
  const [showConfirmModal, setShowConfirmModal] = createSignal(false);
  const [showTerminateFailedModal, setShowTerminateFailedModal] = createSignal(false);
  const [terminating, setTerminating] = createSignal(false);

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
        taskId: props.taskId
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
          <span class="progress-indicator-bar" style={{ width: `${props.progress}%` }}></span>
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
