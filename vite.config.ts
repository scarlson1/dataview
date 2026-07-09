/// <reference types="vitest/config" />
import { devtools } from '@tanstack/devtools-vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // supabase/functions tests are Deno tests (run via `deno test`), not vitest
    exclude: ['**/node_modules/**', 'supabase/**'],
  },
  server: {
    port: 3000,
  },
  plugins: [
    devtools(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
  ],
});

export default config;
