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

    // First-pass yield is a spec band now, not a bare tile, so the figure sits
    // between a status glyph and its unit. Assert the *readout* — the sentence a
    // screen reader gets — because that is the thing that has to be true.
    expect(
      await screen.findByText(/71\.7\s*% — in spec\. Specification 40\.0–80\.0 %/),
    ).toBeInTheDocument();
    expect(screen.getByText('First-pass yield')).toBeInTheDocument();
    expect(screen.getByText('Pilotlinie 1', { exact: false })).toBeInTheDocument();
  });

  it('states which way yield moved, without leaning on a colour', async () => {
    mockFetch(OVERVIEW);
    renderWithProviders(<DashboardView locale="en" />);

    // Yield is a band now: the band carries the verdict and this line carries
    // the movement. Direction is in the sign, so the reading needs no arrow and
    // no status colour — and must not acquire one, or it would be a second
    // signal saying something the band already said better.
    const delta = await screen.findByText('+5.4 pp versus the previous period');
    expect(delta.className).not.toMatch(/status-/);
  });

  it('reads falling scrap as good news', async () => {
    // Scrap is not a band — no plant specifies a total scrap rate — so it keeps
    // a tile, and the tile's intent is derived from meaning rather than from
    // the sign. Getting this backwards makes a worsening line look improving.
    mockFetch(OVERVIEW);
    renderWithProviders(<DashboardView locale="en" />);

    const scrapDelta = await screen.findByText('-5.3 pp');
    expect(scrapDelta.parentElement).toHaveClass('text-status-success-fg');
  });

  it('judges yield against the band for the kind of line it is', async () => {
    mockFetch(OVERVIEW);
    renderWithProviders(<DashboardView locale="en" />);

    // 71.7% is a good week on a pilot line and a crisis on a production one.
    // The fixture's line is `pilot`, so the reading must be drawn against
    // 40–80 — the whole reason a bare number with an arrow could not do this.
    expect(
      await screen.findByText(/Specification 40\.0–80\.0 %, target 70\.0 %/),
    ).toBeInTheDocument();
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

  it('renders every spec band with its verdict in words', async () => {
    mockFetch(OVERVIEW);
    renderWithProviders(<DashboardView locale="en" />);

    // Three bands now — yield, capacity retention, and the one process
    // parameter in the fixture. Each states its verdict in words rather than by
    // hue, so a reader who cannot see the colour still gets the answer.
    const readouts = await screen.findAllByText(/— (in spec|out of spec)/);
    expect(readouts).toHaveLength(3);
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
