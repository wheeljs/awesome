import { TauriWindow as Window } from './components/TauriWindow';
import { Task } from './task/index';
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
