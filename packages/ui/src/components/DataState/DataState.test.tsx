import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataState } from './DataState.js';

const CHILD = <p>Yield by line</p>;

describe('DataState', () => {
  it('announces the wait rather than shimmering silently', () => {
    render(
      <DataState status="loading" loadingLabel="Loading yield figures">
        {CHILD}
      </DataState>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading yield figures');
    expect(screen.queryByText('Yield by line')).not.toBeInTheDocument();
  });

  it('interrupts on failure', () => {
    render(
      <DataState status="error" loadingLabel="…" errorTitle="Could not load yield figures">
        {CHILD}
      </DataState>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load yield figures');
  });

  it('distinguishes empty from broken', () => {
    // A successful request with no rows is not an error, and telling the user
    // it is teaches them to distrust every error the app shows.
    render(
      <DataState status="ready" empty loadingLabel="…" emptyTitle="No batches recorded yet">
        {CHILD}
      </DataState>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('No batches recorded yet');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the data when it is ready', () => {
    render(
      <DataState status="ready" loadingLabel="…">
        {CHILD}
      </DataState>,
    );
    expect(screen.getByText('Yield by line')).toBeInTheDocument();
  });
});
