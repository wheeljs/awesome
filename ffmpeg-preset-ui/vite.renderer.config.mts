import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
// eslint-disable-next-line import/no-unresolved
import devtools from 'solid-devtools/vite';

// https://vitejs.dev/config
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      ...(mode === 'development' ? [devtools({
        autoname: true,
      })] : []),

      solid(),
    ],
  };
});
