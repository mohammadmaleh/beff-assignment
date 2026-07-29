import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle with only the files actually needed,
  // so the production image does not ship node_modules. Required by the
  // Dockerfile's runner stage.
  output: 'standalone',

  // The monorepo root, not apps/web — otherwise standalone tracing misses
  // workspace packages.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,

  reactStrictMode: true,

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
