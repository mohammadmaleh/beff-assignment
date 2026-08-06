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

    // See the matching note in packages/ui - turbo runs both suites at once and
    // unbounded jsdom forks starve each other on a two-core runner.
    maxWorkers: 2,

    // Raised from the 5s default. With `maxWorkers: 2` on a constrained box,
    // constructing a jsdom environment dominates the run - a test that takes
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
      // scoring 0% - and the percentage goes up when you add one. That is the
      // opposite of what a floor is for.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        // Test infrastructure, not the thing under test.
        'src/test/**',
        // Route files: server components, layouts and metadata that Next
        // renders and vitest does not. They are covered by the 54 Playwright
        // tests running against the standalone server the Docker image
        // executes - counting them here would either drag the floor to a
        // number that gates nothing, or invite fake unit tests that render a
        // server component in jsdom and prove only that it did not throw.
        'src/app/**',
      ],

      // The honest number, not an aspiration. `ENG-44` closed the gap this
      // comment used to describe: AppShell, AuthForm, CookieBanner,
      // WaitlistForm and AuthProvider each have a suite now, as do the four
      // remaining zero-coverage units (SiteHeader, SiteFooter, ThemeScript,
      // Providers), which took the floor from ~50% to the numbers below.
      //
      // Each is set a little under the measured value, which is the point of a
      // floor: it fails on a *regression*, not on the ordinary drift of a
      // refactor that removes a covered line. Raise them when real coverage
      // rises; never lower one to make a red run green.
      // Lowered when the chart *primitives* moved to `@beff/ui` - `lib/chart`,
      // `ChartFigure`, `DataTable` and `EChart`, which between them were ~750
      // near-fully-covered statements. They are still tested, and tested
      // harder: `packages/ui` went from 93.85% to 98.63% absorbing them, and
      // `useChartTokens` gained the direct suite it never had. What left this
      // package is the denominator, not the tests.
      //
      // That is the one case where lowering a floor is honest rather than a
      // red run made green, and the arithmetic is the evidence: the same suite
      // measured 96.17 / 89.06 / 92.34 / 96.92 across both packages before the
      // move and 94.66 / 91.19 / 89.29 / 95.11 across this one after it, with
      // no test deleted and ten added. What remains here is the domain layer,
      // whose charts have always sat near 90% because their ECharts option
      // builders are only partly reachable in jsdom.
      //
      // Moved again when `CookieBanner`, `ThemeToggle` and `ThemeScript`
      // followed the chart layer into `@beff/ui` - three more well-covered
      // units out of this denominator, 356 tests here becoming 324 here and
      // 307 there. Same arithmetic, same conclusion: 94.66 -> 94.06 statements
      // with no test deleted and several added, while `packages/ui` went
      // 98.63 -> 99.14.
      //
      // Each is set a little under the measured value. Raise them when real
      // coverage rises; never lower one to make a red run green.
      //
      // Raised when `OnboardingWizard` got the middle of its own flow tested.
      // Its suite entered at `role` and at `review`, which left every control on
      // `plant`, `lines` and `units` - and the back button - never rendered:
      // 64% of the file's functions, in the three steps where the wizard
      // actually collects anything. A control whose `onChange` has never run is
      // one nobody has checked is wired to the right key, and that failure is
      // invisible on screen. Measured 95.73 / 91.69 / 92.48 / 96.37.
      thresholds: {
        statements: 95,
        branches: 91,
        functions: 92,
        lines: 96,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
