import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AlertPrefixes } from '../Alert/index';

import { DataState } from './DataState';

const CHILD = <p>Yield by line</p>;

const PREFIXES: AlertPrefixes = {
  info: 'Note',
  success: 'Success',
  warning: 'Warning',
  danger: 'Error',
};

/**
 * Every user-facing string is required, so each render site has to pass the
 * full set. That verbosity is the feature: it is what stopped the German
 * surfaces inheriting English fallbacks.
 */
const WORDS = {
  loadingLabel: '…',
  emptyTitle: 'Nothing recorded yet',
  errorTitle: 'That did not load',
  alertPrefixes: PREFIXES,
} as const;

describe('DataState', () => {
  it('announces the wait rather than shimmering silently', () => {
    render(
      <DataState {...WORDS} status="loading" loadingLabel="Loading yield figures">
        {CHILD}
      </DataState>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading yield figures');
    expect(screen.queryByText('Yield by line')).not.toBeInTheDocument();
  });

  it('interrupts on failure', () => {
    render(
      <DataState {...WORDS} status="error" errorTitle="Could not load yield figures">
        {CHILD}
      </DataState>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load yield figures');
  });

  it('distinguishes empty from broken', () => {
    // A successful request with no rows is not an error, and telling the user
    // it is teaches them to distrust every error the app shows.
    render(
      <DataState {...WORDS} status="ready" empty emptyTitle="No batches recorded yet">
        {CHILD}
      </DataState>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('No batches recorded yet');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the data when it is ready', () => {
    render(
      <DataState {...WORDS} status="ready">
        {CHILD}
      </DataState>,
    );
    expect(screen.getByText('Yield by line')).toBeInTheDocument();
  });
});
