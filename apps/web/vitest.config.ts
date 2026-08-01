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

    // Raised from the 5s default. With `maxWorkers: 2` on a constrained box,
    // constructing a jsdom environment dominates the run — a test that takes
    // 187ms in isolation was measured at 6.3s inside a full file, and failed on
    // the timeout while behaving perfectly. A timeout that fires on
    // environment contention rather than on a hung component teaches everyone
    // to re-run the suite instead of reading it.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
