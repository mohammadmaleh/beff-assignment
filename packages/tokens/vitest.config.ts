import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Co-located with the code they cover, matching the backend convention.
    include: ['src/**/*.{test,spec}.ts'],

    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],

      // Naming `include` is what makes this a gate rather than a readout.
      // Vitest 4 counts only the files a test actually imported unless you say
      // otherwise, so an untested module scores *nothing* instead of scoring
      // 0% — and the percentage goes up when you add one.
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts'],

      // The only executable code here is the contrast maths that every palette
      // decision is argued from, so this package is held to 100%. It is a
      // realistic floor precisely because there is so little of it — the
      // ramps themselves are JSON.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
