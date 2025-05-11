import { getCurrentWindow, type PhysicalPosition } from '@tauri-apps/api/window';

export type TauriDragAndDropProps = {
  onDrop: (event: {
    type: 'drop';
    paths: string[];
    position: PhysicalPosition;
  }) => void;
};

export function tauriDragAndDrop(props: TauriDragAndDropProps) {
  const tauriWindow = getCurrentWindow();
  return tauriWindow.onDragDropEvent(async (event) => {
    if (event.payload.type === 'drop') {
      props.onDrop(event.payload);
    }
  });
}
