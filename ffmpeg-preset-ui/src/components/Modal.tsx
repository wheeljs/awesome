import { Show, children, mergeProps, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';

import './Modal.scss';

export type ModalProps = {
  show?: boolean;
  title?: string;
  children?: () => JSX.Element;
  showClose?: boolean;
  okButtonText?: string;
  showCancelButton?: boolean;
  cancelButtonText?: string;

  onOk?: Function;
  onCancel?: (type: 'close' | 'cancel') => unknown;
};

const defaultModalProps: ModalProps = {
  show: false,
  okButtonText: 'Ok',
  showCancelButton: false,
  cancelButtonText: 'Cancel',
};

export function Modal(props: ModalProps) {
  const mergedProps = mergeProps(defaultModalProps, props);
  const resolvedChildren = children(() => mergedProps.children?.());

  const handleOk = () => {
    mergedProps.onOk?.();
  };

  const handleCancel = () => {
    mergedProps.onCancel?.('cancel');
  };

  const handleClose = () => {
    mergedProps.onCancel?.('close');
  }; 

  return (
    <Show when={mergedProps.show}>
      <Portal mount={document.querySelector('body') as Node}>
        <div class="modal__backdrop">
          <div class="modal window">
            <div class="title-bar">
              <div class="title-bar-text">{mergedProps.title}</div>
              <div class="title-bar-controls">
                <button aria-label="Close" onClick={handleClose}></button>
              </div>
            </div>
            <div class="window-body">
              <div class="window-body__content">
                {resolvedChildren()}
              </div>
              <section class="field-row" style="justify-content: flex-end;">
                <button onClick={handleOk}>{mergedProps.okButtonText}</button>
                <Show when={mergedProps.showCancelButton}>
                  <button onClick={handleCancel}>{mergedProps.cancelButtonText}</button>
                </Show>
              </section>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
