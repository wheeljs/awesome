import { onMount, onCleanup } from 'solid-js';

export type FileWithPath = File & {
  absolutePath: string;
};

export type FileDropProps = {
  onDrop?: (event: DragEvent) => void;
  onFileDrop: (files: FileWithPath[]) => void;
};

export function useFileDrop(props: FileDropProps) {
  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    props.onDrop?.(event);

    if (event.dataTransfer?.files) {
      const filesWithPath = Array.from(event.dataTransfer.files, (file) => {
        const absolutePath = window.electronAPI.getFilePath(file);
        return {
          ...file,
          absolutePath,
        };
      });

      props.onFileDrop(filesWithPath);
    }
  };

  onMount(() => {
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
  });

  onCleanup(() => {
    window.removeEventListener('dragover', onDragOver);
    window.removeEventListener('drop', onDrop);
  });
}
