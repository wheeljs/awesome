import path from 'path';
import { app, BrowserWindow, ipcMain, Menu, session, shell, WebContents } from 'electron';
import { spawn } from 'child_process';
import started from 'electron-squirrel-startup';

import { handler } from './chooseFile';
import { buildParseCommand, tryConvertingLine, tryDurationLine, tryPercentLine, trySummaryLine, type Summary } from './parser';
import { generateUuid, killTasks, killTasksOnWindowCloseRequested } from './utils';
import type { ParseTask } from './types';
import type { StartParseResult, StartParsePayload, ParseEventData } from '../shared/types';

if (started) {
  app.quit();
}

app.setAppUserModelId("com.squirrel.FFmpegPreset.FFmpegPreset");

const runningTasks = new Map<string, ParseTask>();

function createWindow() {
  const win = new BrowserWindow({
    title: 'FFmpeg Preset',
    titleBarStyle: 'hidden',
    width: 800,
    height: 600,
    backgroundColor: '#c0c0c0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  win.on('close', (event) => {
    killTasksOnWindowCloseRequested(win, event, runningTasks);
  });

  // const devUrl = process.env.VITE_DEV_SERVER_URL || `http://localhost:${process.env.VITE_PORT || 8080}`;
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    try {
      win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      win.webContents.openDevTools();
      return;
    } catch (e) {
      // fallthrough to load file
    }
  }

  if (app.isPackaged) {
    Menu.setApplicationMenu(null);
  }

  win.loadFile(path.join(__dirname, '..', 'renderer', 'main_window', 'index.html'));
}

app.whenReady().then(async () => {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    console.log('If you want to debug solid component, please see https://www.electronjs.org/docs/latest/tutorial/devtools-extension#manually-loading-a-devtools-extension and uncomment below line.');
    // await session.defaultSession.extensions.loadExtension('path/to/kmcfjchnmmaeeagadbhoofajiopoceel/version');
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.handle('request-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win.isMaximized()) {
    return win.unmaximize();
  }

  win.maximize();
});

ipcMain.handle('request-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  win.minimize();
});

ipcMain.handle('request-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  win.close();
});

ipcMain.handle('choose-file', handler);

ipcMain.handle('show-item-in-folder', async (_event, { path }: { path: string; }) => {
  shell.showItemInFolder(path);
});


const sendStartedParse = (sender: WebContents, data: ParseEventData['data']) => sender.send('parse-event', {
  event: 'started',
  data,
});
ipcMain.handle('start-parse', async (event, { options, taskOptions }: StartParsePayload): Promise<StartParseResult> => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);

  const id = generateUuid();
  const parseCommand = buildParseCommand(options);

  // Create shell invocation similar to original: --login -c "<args...>"
  const args = ['--login', '-c', parseCommand.args.join(' ')];
  if (taskOptions.raw) {
    if (process.platform === 'win32') {
      const proc = spawn('cmd.exe', [
        '/c',
        'start',
        '""',
        `"${parseCommand.command}"`,
        '--login',
        '-c',
        `"${parseCommand.args.join(' ')}; echo; echo Press any key to close...; read -n 1"`,
      ], {
        windowsVerbatimArguments: true,
      });
      proc.on('close', (code) => {
        event.sender.send('parse-event', {
          event: 'finished',
          data: {
            id,
            success: code === 0,
            summaries: [],
          },
        });
      });

      sendStartedParse(event.sender, { id });

      return {
        started: true,
        id,
      };
    }
  }

  const child = spawn(parseCommand.command, args, { stdio: ['pipe', 'pipe', 'pipe'] });

  const parseTask = {
    duration: 0,
    percent: 0,
    process: child,
  };
  runningTasks.set(id, parseTask);

  sendStartedParse(event.sender, { id });

  const summaries: Summary[] = [];

  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line) {
        continue;
      }

      const conv = tryConvertingLine(line);
      if (conv) {
        if (conv.type === 'started') {
          event.sender.send('parse-event', {
            event: 'startParseFile',
            data: {
              id,
              source: conv.input,
              target: conv.output,
            },
          });
        } else if (conv.type === 'succeed') {
          event.sender.send('parse-event', {
            event: 'parseFileSuccess',
            data: {
              id,
              source: conv.input,
              target: conv.output,
            },
          });
        } else if (conv.type === 'failed') {
          event.sender.send('parse-event', {
            event: 'parseFileFailed',
            data: {
              id,
              source: conv.input,
              target: conv.output,
            },
          });
        }
      }

      const summary = trySummaryLine(line);
      if (summary) {
        summaries.push(summary);
      }

      if (taskOptions?.need_std_output) {
        event.sender.send('parse-event', {
          event: 'stdOutput',
          data: {
            id,
            type: 'stdout',
            content: line,
          },
        });
      }
    }
  });

  child.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line) {
        continue;
      }

      const totalDuration = tryDurationLine(line);
      if (totalDuration !== null) {
        parseTask.duration = totalDuration;
      }

      const currentDuration = tryPercentLine(line);
      if (currentDuration !== null && parseTask.duration !== null) {
        const percent = Math.round((currentDuration / parseTask.duration) * 100);
        const pct = Math.min(100, percent);
        
        browserWindow?.setProgressBar?.(pct / 100);

        event.sender.send('parse-event', {
          event: 'percentProgress',
          data: {
            id,
            percent: pct,
          },
        });
      }

      if (taskOptions?.need_std_output) {
        event.sender.send('parse-event', {
          event: 'stdOutput',
          data: {
            id,
            type: 'stderr',
            content: line,
          },
        });
      }
    }
  });

  child.on('exit', (code) => {
    runningTasks.delete(id);
    browserWindow?.setProgressBar?.(-1);
    event.sender.send('parse-event', {
      event: 'finished',
      data: {
        id,
        success: code === 0,
        summaries,
      },
    });
  });

  return { started: true, id };
});

ipcMain.handle('terminate-parse', async (_event, { taskId }) => {
  const parseTask = runningTasks.get(taskId);
  const proc = parseTask?.process;

  if (!proc) {
    throw new Error(`Process with taskId ${taskId} not found.`);
  }
  if (proc.killed) {
    throw new Error(`Process with taskId ${taskId} is already terminated.`);
  }

  try {
    return killTasks([proc]);
  } catch (e) {
    throw new Error(
      `Failed to terminate process with taskId ${taskId}: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e }
    );
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
