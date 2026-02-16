import { BrowserWindow, dialog, type OpenDialogReturnValue, type IpcMainInvokeEvent, type OpenDialogOptions } from 'electron';

const DialogOptionsByType: Record<string, OpenDialogOptions> = {
    Bash: {
        title: 'Choose command like bash.exe',
        properties: ['openFile', 'dontAddToRecent'],
    },
    LowVideoBash: {
        title: 'Choose low-video.bash',
        filters: [
            { extensions: ['bash'], name: 'low-video.bash' },
        ],
        properties: ['openFile', 'dontAddToRecent'],
    },
    Video: {
        title: 'Choose video(s)',
        properties: ['openFile', 'multiSelections'],
    },
    TargetFolder: {
        title: 'Choose target file folder',
        properties: ['openDirectory', 'dontAddToRecent'],
    },
};

interface Handler {
    (event: IpcMainInvokeEvent, args: {
        type: keyof typeof DialogOptionsByType,
        defaultPath?: string,
    }): Promise<unknown>;
}

export const handler: Handler = async function(event, { type, ...restOptions }) {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    const typeOptions = DialogOptionsByType[type];
    
    if (!typeOptions) {
        throw new Error(`Unknown file type: ${type}`);
    }
    const options = Object.assign({}, restOptions, typeOptions);

    let pending: Promise<OpenDialogReturnValue>;
    if (browserWindow) {
        pending = dialog.showOpenDialog(browserWindow, options);
    } else {
        pending = dialog.showOpenDialog(options);
    }

    const { canceled, filePaths } = await pending;
    if (canceled) {
        throw new Error('User cancel selection');
    }
    return filePaths;
}
