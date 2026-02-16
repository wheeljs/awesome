import { type Component, type JSX, children } from 'solid-js';

import './TauriWindow.scss';

type TauriWindowProps = {
  children: () => JSX.Element;
};

export const TauriWindow: Component<TauriWindowProps> = (props) => {
  const child = children(props.children);

  const handleMinimize = () => {
    window.electronAPI.requestMinimize();
  };

  const handleMaximize = () => {
    window.electronAPI.requestMaximize();
  };

  const handleClose = () => {
    window.electronAPI.requestClose();
  };

  return (
    <div class="window tauri-window">
      <div class="title-bar">
        <div class="title-bar-text">FFmpeg Preset</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize" onClick={handleMinimize}></button>
          <button aria-label="Maximize" onClick={handleMaximize}></button>
          <button aria-label="Close" onClick={handleClose}></button>
        </div>
      </div>
      <div class="window-body">{child()}</div>
    </div>
  );
};
