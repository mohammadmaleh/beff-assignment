'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { AuthProvider } from '@/lib/auth';

/**
 * Client-side providers.
 *
 * The `QueryClient` is created in state rather than at module scope: a module
 * singleton is shared across requests on the server, which leaks one user's
 * cached data into another user's render.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Production figures move on a shift boundary, not on a window
            // focus. Refetching every time the engineer alt-tabs back is noise
            // and load for nothing.
            refetchOnWindowFocus: false,
            staleTime: 60_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
