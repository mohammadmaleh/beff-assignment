import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Co-located with the code they cover, matching the backend convention.
    include: ['src/**/*.{test,spec}.ts'],
  },
});
