import { type ChildProcess } from "child_process";

export type ParseTask = {
  duration: number;
  percent: number;
  process: ChildProcess;
};
