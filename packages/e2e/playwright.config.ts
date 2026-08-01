import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright, scoped to what runs without the API.
 *
 * The suite starts `next start` against a production build and drives the
 * statically generated surfaces — landing, both legal pages, 404. Those need no
 * database, so this can run in CI as its own job without standing up Postgres.
 * The authenticated flows are the other half of ENG-39 and do need the stack.
 *
 * A production build rather than `next dev` on purpose: dev mode ships different
 * markup (error overlays, unminified hydration) and an accessibility pass
 * against markup nobody ships proves nothing about what does.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // One worker. This box is memory-constrained and two Chromium instances
  // starve each other into timeouts that look like flakes and are not.
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // WebKit and mobile are on the scope-warning cut list and are deliberately
    // absent rather than declared and skipped — a project that never runs is a
    // project that silently rots.
  ],

  webServer: {
    // The **standalone** server, not `next start`. The app builds with
    // `output: 'standalone'` for the production Docker image, and `next start`
    // warns that it does not support that mode — testing through it would mean
    // asserting against a server nobody deploys. This is the exact entry point
    // the runner stage in `apps/web/Dockerfile` executes.
    //
    // Port 3100, not 3000: a developer with `docker compose up` running should
    // not have this fight their stack for the port.
    // `output: 'standalone'` emits the server but **not** `.next/static` or
    // `public` — Next expects the deployer to place them, and
    // `apps/web/Dockerfile` does exactly this copy on lines 58-59. Without it
    // the server runs and every page arrives unstyled, which fails the contrast
    // rules for a reason that has nothing to do with the design.
    // `public/` is not copied because the app does not have one; the Dockerfile
    // copies it unconditionally, which would need revisiting if that changed.
    command:
      'cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static ' +
      '&& node apps/web/.next/standalone/apps/web/server.js',
    url: 'http://127.0.0.1:3100/en',
    env: { PORT: '3100', HOSTNAME: '127.0.0.1' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: '../..',
  },
});
