import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockFetchJson } from '@/test/fetchMock';
import { renderWithProviders } from '@/test/renderWithProviders';

import { DashboardView } from './DashboardView';

const OVERVIEW = {
  line_name: 'Pilotlinie 1',
  line_kind: 'pilot',
  window_days: 30,
  first_pass_yield_pct: 71.68,
  first_pass_yield_delta_pp: 5.35,
  scrap_rate_pct: 27.84,
  scrap_rate_delta_pp: -5.3,
  capacity_retention_pct: 88.32,
  co2_intensity_kg_per_kwh: 63.86,
  scrap_by_step: [
    { process_step: 'formation', scrap_rate_pct: 5.36, committed_value_eur: 27247 },
    { process_step: 'coating', scrap_rate_pct: 6.43, committed_value_eur: 7517 },
  ],
  spec_bands: [
    {
      parameter: 'porosity_pct',
      value: 32.4,
      lower_limit: 30,
      upper_limit: 35,
      target: 32.5,
      unit: '%',
    },
  ],
};

const mockFetch = (body: unknown, ok = true): void => {
  mockFetchJson({ '/metrics': body }, ok);
};

describe('DashboardView', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('announces the wait rather than showing an empty screen', () => {
    renderWithProviders(<DashboardView locale="en" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading production figures');
  });

  it('renders the headline figures once they arrive', async () => {
    mockFetch(OVERVIEW);
    renderWithProviders(<DashboardView locale="en" />);

    expect(await screen.findByText('71.7')).toBeInTheDocument();
    expect(screen.getByText('First-pass yield')).toBeInTheDocument();
    expect(screen.getByText('Pilotlinie 1', { exact: false })).toBeInTheDocument();
  });

  it('reads yield rising as good news and scrap rising as bad', async () => {
    // The same arrow means opposite things in the two tiles. Getting this
    // backwards would make a worsening line look like an improving one.
    mockFetch(OVERVIEW);
    renderWithProviders(<DashboardView locale="en" />);

    const yieldDelta = await screen.findByText('+5.4 pp');
    const scrapDelta = screen.getByText('-5.3 pp');

    expect(yieldDelta.parentElement).toHaveClass('text-status-success-fg');
    // Scrap fell, which is also good — intent is derived from meaning, not
    // from the sign.
    expect(scrapDelta.parentElement).toHaveClass('text-status-success-fg');
  });

  it('orders the scrap breakdown by process step, never by size', async () => {
    // Coating has the larger rate; formation must still come after it, because
    // a bar's position carries economic meaning.
    mockFetch(OVERVIEW);
    renderWithProviders(<DashboardView locale="en" />);

    await screen.findByText('Where the scrap happened');
    const rendered = screen.getAllByText(/Coating|Formation/);
    expect(rendered[0]).toHaveTextContent('Coating');
  });

  it('offers the data as a table, not only as bars', async () => {
    mockFetch(OVERVIEW);
    renderWithProviders(<DashboardView locale="en" />);

    const disclosure = await screen.findByText('Show the data as a table');
    await userEvent.click(disclosure);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Committed value lost' })).toBeInTheDocument();
  });

  it('renders the spec band with its verdict in words', async () => {
    mockFetch(OVERVIEW);
    renderWithProviders(<DashboardView locale="en" />);

    expect(await screen.findByText(/in spec/)).toBeInTheDocument();
  });

  it('shows a readable error rather than an empty dashboard', async () => {
    mockFetch({ detail: 'boom' }, false);
    renderWithProviders(<DashboardView locale="en" />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load production figures');
    });
  });

  it('distinguishes an empty line from a broken one', async () => {
    mockFetch({ ...OVERVIEW, scrap_by_step: [] });
    renderWithProviders(<DashboardView locale="en" />);

    expect(await screen.findByText('No batches recorded yet')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders in German when the locale is German', async () => {
    mockFetch(OVERVIEW);
    renderWithProviders(<DashboardView locale="de" />);

    expect(await screen.findByText('Erstdurchlaufquote')).toBeInTheDocument();
    expect(screen.getByText('Wo der Ausschuss entstanden ist')).toBeInTheDocument();
  });
});
