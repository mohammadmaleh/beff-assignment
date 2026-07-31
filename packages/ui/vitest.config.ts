import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Co-located with the component they cover, matching the rest of the repo.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],

    // Turbo runs this suite and the web app's in parallel, and each fork boots
    // its own jsdom. Unbounded, they oversubscribe the box and vitest fails
    // with "Timeout waiting for worker to respond" — a starved worker, not a
    // failing test. CI runners are two-core, so this is the honest ceiling.
    maxWorkers: 2,
  },
});
