import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Render a component inside a React Query provider.
 *
 * `retry: false` because the default retries a failed query three times with
 * backoff, so a test asserting the error state would wait seconds and then
 * time out on a component that is behaving correctly.
 *
 * A fresh `QueryClient` per render, so one test's cache cannot satisfy the
 * next test's query and make an assertion pass without the fetch it was
 * supposed to exercise.
 */
export function renderWithProviders(ui: ReactElement): RenderResult {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return render(ui, { wrapper: Wrapper });
}
