import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright, scoped to what runs without the API.
 *
 * The suite starts `next start` against a production build and drives the
 * statically generated surfaces - landing, both legal pages, 404. Those need no
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
    // absent rather than declared and skipped - a project that never runs is a
    // project that silently rots.
  ],

  webServer: {
    // The **standalone** server, not `next start`. The app builds with
    // `output: 'standalone'` for the production Docker image, and `next start`
    // warns that it does not support that mode - testing through it would mean
    // asserting against a server nobody deploys. This is the exact entry point
    // the runner stage in `apps/web/Dockerfile` executes.
    //
    // Port 3100, not 3000: a developer with `docker compose up` running should
    // not have this fight their stack for the port.
    // `output: 'standalone'` emits the server but **not** `.next/static` or
    // `public` - Next expects the deployer to place them, and
    // `apps/web/Dockerfile` does exactly this copy on lines 58-59. Without it
    // the server runs and every page arrives unstyled, which fails the contrast
    // rules for a reason that has nothing to do with the design.
    // `public/` is copied for the same reason, and it is not hypothetical: the
    // favicon lives there, and without this line it 404s here while working
    // perfectly in Docker - the exact server-divergence this whole comment
    // exists to prevent. These two copies mirror `apps/web/Dockerfile:58-59`;
    // if one changes, so must the other.
    //
    // `mkdir -p` then `cp -r <src>/. <dst>/`, not `cp -r <src> <dst>`: the
    // second form copies *into* the destination once it exists, so a second
    // local run silently produces `.next/static/static` and every asset 404s.
    // CI never sees it - it always starts from a fresh checkout - which is
    // exactly the kind of failure that only ever happens on someone's laptop.
    command:
      'mkdir -p apps/web/.next/standalone/apps/web/.next/static apps/web/.next/standalone/apps/web/public ' +
      '&& cp -r apps/web/.next/static/. apps/web/.next/standalone/apps/web/.next/static/ ' +
      '&& cp -r apps/web/public/. apps/web/.next/standalone/apps/web/public/ ' +
      '&& node apps/web/.next/standalone/apps/web/server.js',
    url: 'http://127.0.0.1:3100/en',
    env: { PORT: '3100', HOSTNAME: '127.0.0.1' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: '../..',
  },
});
