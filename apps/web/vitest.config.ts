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

    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],

      // Naming `include` is what makes this a gate rather than a readout.
      // Vitest 4 counts only the files a test actually imported unless you say
      // otherwise, so an untested component scores *nothing* instead of
      // scoring 0% — and the percentage goes up when you add one. That is the
      // opposite of what a floor is for.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        // Test infrastructure, not the thing under test.
        'src/test/**',
        // Route files: server components, layouts and metadata that Next
        // renders and vitest does not. They are covered by the 54 Playwright
        // tests running against the standalone server the Docker image
        // executes — counting them here would either drag the floor to a
        // number that gates nothing, or invite fake unit tests that render a
        // server component in jsdom and prove only that it did not throw.
        'src/app/**',
      ],

      // The honest number, not an aspiration. See the note in ROADMAP.md: a
      // block of client components (AppShell, AuthForm, CookieBanner,
      // WaitlistForm, AuthProvider) has no unit tests and is exercised only
      // through Playwright, which is what holds this floor near 50%. The gate
      // exists to stop it *falling* — raise each number as those land.
      thresholds: {
        statements: 48,
        branches: 54,
        functions: 50,
        lines: 47,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
