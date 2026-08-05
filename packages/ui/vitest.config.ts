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

    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],

      // `include` is what makes this a gate rather than a readout. Vitest 4
      // counts only the files a test actually imported unless you name them,
      // so an untested component scores *nothing* instead of scoring 0% — and
      // the percentage goes up when you add one. Barrels are excluded because
      // a re-export has no branches and dilutes the denominator.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec,stories}.{ts,tsx}', 'src/**/index.ts'],

      // Set just under where the suite already sits, so an ordinary refactor
      // does not trip it and deleting a test does. Raise these when the real
      // number rises — a floor left far below reality gates nothing.
      //
      // Raised when the chart layer moved in from `apps/web`: `lib/chart`,
      // `ChartFigure`, `DataTable` and `EChart` arrived with their own suites,
      // and `useChartTokens` — which had only ever been covered as a side
      // effect of mounting a chart — gained a direct one. Raised again when
      // `CookieBanner`, `ThemeToggle` and `ThemeScript` arrived with their
      // suites. Measured 99.14 / 96.55 / 100 / 99.67.
      thresholds: {
        statements: 99,
        branches: 96,
        functions: 100,
        lines: 99,
      },
    },
  },
});
