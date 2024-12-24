import { createContext, type Accessor } from 'solid-js';

export type TaskContextProps = {
  parseFinishedSignal: Accessor<number>;
};

export const TaskContext = createContext<TaskContextProps>({
  parseFinishedSignal: () => 0,
});

export type TaskFileContextProps = {
  getAboveTarget: (index: number) => string;
};

export const TaskFileContext = createContext<TaskFileContextProps>({
  getAboveTarget: () => '',
});
