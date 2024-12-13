import { createSignal } from "solid-js";
import logo from "./assets/logo.svg";
import { invoke, Channel } from "@tauri-apps/api/core";
import "./App.css";
import DnDDemo from './DndDemo';

function App() {
  const [greetMsg, setGreetMsg] = createSignal("");
  const [name, setName] = createSignal("");
  const [renderDnd, setRenderDnd] = createSignal(false);

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name: name() }));
  }

  function handleExecute() {
    const onEvent = new Channel();
    onEvent.onmessage = (message: any) => {
      console.log(`download event (${message.event})`, message.data);
    };
    const result = invoke('test_execute', {
      onEvent,
    });
    result.then((...args) => {
      console.log('fulfilled', ...args);
    }, (err) => {
      console.error('rejected', err);
    });
  }

  return (
    <main class="container">
      <h1>Welcome to Tauri + Solid</h1>

      <div class="row">
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" class="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" class="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://solidjs.com" target="_blank">
          <img src={logo} class="logo solid" alt="Solid logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and Solid logos to learn more.</p>

      <form
        class="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <input type="checkbox" onChange={() => setRenderDnd(!renderDnd())} />
        { renderDnd() && <DnDDemo />}
        <button type="submit">Greet</button>
        <button type="button" onClick={handleExecute}>Execute!</button>
      </form>
      <p>{greetMsg()}</p>
    </main>
  );
}

export default App;
