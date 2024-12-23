import { createContext, type Accessor } from 'solid-js';

export type TaskContextProps = {
  parseFinishedSignal: Accessor<number>;
};

export const TaskContext = createContext<TaskContextProps>({
  parseFinishedSignal: () => 0,
});
