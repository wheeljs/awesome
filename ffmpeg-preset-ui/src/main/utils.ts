import { randomBytes } from 'crypto';
import { exec, type ChildProcess } from 'child_process';
import { dialog, BrowserWindow, Event } from 'electron';

import { ParseTask } from './types';

export function generateUuid(): string {
  // generate RFC4122 v4-like UUID bytes then base64url encode without padding
  const bytes = randomBytes(16);
  // set version to 4 -> xxxx0100 in high nibble of 7th byte (index 6)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // set variant to RFC 4122 -> 10xxxxxx in 9th byte (index 8)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const b64 = Buffer.from(bytes).toString('base64');
  // base64url
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function killTasks(processes: ChildProcess[]): Promise<boolean> {
  if (process.platform === 'win32') {
    const pids = processes.flatMap((proc) => ["/PID", proc.pid]);
    const taskkillArgs = ["/F", "/T", ...pids];

    return new Promise((resolve) => {
      exec(`taskkill ${taskkillArgs.join(' ')}`, (error, stdout, stderr) => {
        if (error) {
          console.error('Failed to terminate tasks:', stderr);
          return resolve(false);
        }

        console.log('Tasks terminated successfully:', stdout);
        resolve(true);
      });
    });
  }

  processes.forEach((proc) => proc.kill());
  return true;
}

export function killTasksOnWindowCloseRequested(
  window: BrowserWindow,
  event: Event,
  runningTasks: Map<string, ParseTask>,
) {
  const allTasks = Array.from(runningTasks.values());

  if (allTasks.length > 0) {
    const response = dialog.showMessageBoxSync(window, {
      type: 'warning',
      buttons: ['Terminate and Exit', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Confirm',
      message: 'You have running parsing tasks. Closing the application will stop parsing and leave target files in an incomplete state. Are you sure you want to TERMINATE parsing and exit?',
    });

    if (response === 1) {
      // User chose to cancel
      event.preventDefault();
      return;
    }

    // Terminate all running tasks
    killTasks(allTasks.map((x) => x.process)).then((result) => {
      if (!result) {
        console.error('Failed to terminate all tasks. Preventing window close.');
        event.preventDefault();
      }
    });
  }
}
