import { type FFmpegPresetAPI } from '../shared/types';

declare global {
  interface Window {
    electronAPI: FFmpegPresetAPI;
  }
}
