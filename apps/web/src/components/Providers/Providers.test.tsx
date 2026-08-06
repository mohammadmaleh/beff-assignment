import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/lib/auth';
import { mockFetch } from '@/test/fetchMock';

import { Providers } from './Providers';

/** Reports what the tree below the providers can actually reach. */
function Consumer({ onClient }: { onClient?: (client: QueryClient) => void }) {
  const { loading } = useAuth();
  const client = useQueryClient();
  onClient?.(client);
  return <p>{loading ? 'bootstrapping' : 'ready'}</p>;
}

describe('Providers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('supplies both contexts the authenticated surface depends on', async () => {
    mockFetch({ '/auth/refresh': { status: 401 } });

    render(
      <Providers>
        <Consumer />
      </Providers>,
    );

    // Reaching this at all means `useAuth` and `useQueryClient` both found a
    // provider - either missing one throws during render.
    expect(await screen.findByText('ready')).toBeInTheDocument();
  });

  it('gives every render its own query client', async () => {
    // A module-scope `QueryClient` is shared across requests on the server,
    // which leaks one user's cached production figures into another user's
    // render. Creating it in state is what prevents that, and the only
    // observable consequence is this: two trees, two clients.
    mockFetch({ '/auth/refresh': { status: 401 } });
    const clients: QueryClient[] = [];
    const collect = (client: QueryClient): void => {
      if (!clients.includes(client)) clients.push(client);
    };

    render(
      <Providers>
        <Consumer onClient={collect} />
      </Providers>,
    );
    render(
      <Providers>
        <Consumer onClient={collect} />
      </Providers>,
    );

    await waitFor(() => {
      expect(clients).toHaveLength(2);
    });
    expect(clients[0]).not.toBe(clients[1]);
  });

  it('does not refetch production figures when the engineer alt-tabs back', async () => {
    // Figures move on a shift boundary, not on a window focus event.
    mockFetch({ '/auth/refresh': { status: 401 } });
    let client: QueryClient | null = null;

    render(
      <Providers>
        <Consumer
          onClient={(value) => {
            client = value;
          }}
        />
      </Providers>,
    );
    await screen.findByText('ready');

    const defaults = (client as unknown as QueryClient).getDefaultOptions().queries;
    expect(defaults?.refetchOnWindowFocus).toBe(false);
    expect(defaults?.staleTime).toBe(60_000);
  });
});
