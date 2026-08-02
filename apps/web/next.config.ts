import type { NextConfig } from 'next';

import { apiProxyRewrites } from './src/lib/rewrites';

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle with only the files actually needed,
  // so the production image does not ship node_modules. Required by the
  // Dockerfile's runner stage.
  output: 'standalone',

  // The monorepo root, not apps/web — otherwise standalone tracing misses
  // workspace packages.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,

  reactStrictMode: true,

  // `@beff/ui` ships TypeScript source rather than a built `dist`. One less
  // build step to keep in sync, and Next compiles it with the same settings as
  // the app, so a component cannot be built against a different target than the
  // page that renders it.
  transpilePackages: ['@beff/ui', '@beff/api-client'],

  // In production the browser talks only to this origin and Next forwards
  // /api/v1/* to the API host, so the SameSite=Lax refresh cookie keeps working
  // across what would otherwise be a cross-site split. Logic and its failure
  // modes live in `src/lib/rewrites`, which is tested — this is only the wire.
  //
  // Evaluated ONCE, at build time, and frozen into routes-manifest.json. It is
  // not re-read per request, so API_ORIGIN must be present in the build
  // environment and a change to it requires a redeploy.
  async rewrites() {
    return apiProxyRewrites({
      API_ORIGIN: process.env.API_ORIGIN,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    });
  },

  // Security headers. CSP is deliberately absent until the app's real script
  // and style sources are known (ENG-41) — a wrong CSP silently breaks pages.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
