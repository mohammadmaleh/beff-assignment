import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Co-located with the code they cover, matching the backend convention.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],

    // See the matching note in packages/ui — turbo runs both suites at once and
    // unbounded jsdom forks starve each other on a two-core runner.
    maxWorkers: 2,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
