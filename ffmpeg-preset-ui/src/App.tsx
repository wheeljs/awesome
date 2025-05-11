import { TauriWindow as Window } from './components/TauriWindow.tsx';
import { Task } from './task/index.tsx';
import './App.scss';

function App() {
  return (
    <Window>
      {() => (
        <main class="container win-98">
          <Task />
        </main>
      )}
    </Window>
  );
}

export default App;
