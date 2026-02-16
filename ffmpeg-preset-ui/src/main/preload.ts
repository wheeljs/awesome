import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';

import type { FFmpegPresetAPI, ParseEventData } from '../shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
    requestMaximize: () => ipcRenderer.invoke('request-maximize'),
    requestMinimize: () => ipcRenderer.invoke('request-minimize'),
    requestClose: () => ipcRenderer.invoke('request-close'),

    chooseFile: (options) => ipcRenderer.invoke('choose-file', options),
    getFilePath: (file) => webUtils.getPathForFile(file),
    showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', { path }),

    startParse: (options, taskOptions = {}) => ipcRenderer.invoke('start-parse', { options, taskOptions }),
    terminateParse: (taskId: string) => ipcRenderer.invoke('terminate-parse', { taskId }),
    onParseEvent: (cb) => {
        const listener = (_: IpcRendererEvent, payload: ParseEventData) => {
            cb(payload);
        };

        ipcRenderer.on('parse-event', listener);
        return () => ipcRenderer.removeListener('parse-event', listener);
    },
} as FFmpegPresetAPI);
