import { getCurrentWebview } from '@tauri-apps/api/webview';
import { type UnlistenFn } from '@tauri-apps/api/event';
import { createSignal, onCleanup, onMount } from 'solid-js';

function DnDDemo() {
  let unlisten: UnlistenFn;
  onMount(async () => {
    unlisten = await getCurrentWebview().onDragDropEvent((event) => {
      console.log(event.payload.type, event.payload);
    });
  });

  onCleanup(() => {
    unlisten?.();
  });

  return (
    <div style="border:2px dashed #ccc; padding:20px;">
      Drop files here...
    </div>
  );
}

export default DnDDemo;
