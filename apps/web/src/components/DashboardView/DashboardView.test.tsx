import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockFetch as mockRoutes, mockFetchJson } from '@/test/fetchMock';
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

const TREND = {
  line_name: 'Pilotlinie 1',
  line_kind: 'pilot',
  window_days: 30,
  total_cells_started: 2400,
  total_cells_passed: 1721,
  total_cells_scrapped: 679,
  total_committed_value_lost_eur: 34_764,
  window_first_pass_yield_pct: 71.71,
  best_batch_code: 'B-2026-002',
  worst_batch_code: 'B-2026-001',
  benchmark: {
    line_kind: 'pilot',
    sample_size: 34,
    first_pass_yield_p50_pct: 68,
    first_pass_yield_p90_pct: 77.5,
    scrap_rate_p50_pct: 32,
    co2_intensity_p50_kg_per_kwh: 64,
  },
  points: [
    {
      batch_code: 'B-2026-001',
      started_at: '2026-07-01T06:00:00Z',
      cells_started: 1200,
      cells_passed: 816,
      cells_scrapped: 384,
      first_pass_yield_pct: 68,
      scrap_rate_pct: 32,
      capacity_retention_pct: 88.4,
      co2_intensity_kg_per_kwh: 61.2,
      committed_value_lost_eur: 17_400,
    },
    {
      batch_code: 'B-2026-002',
      started_at: '2026-07-20T06:00:00Z',
      cells_started: 1200,
      cells_passed: 905,
      cells_scrapped: 295,
      first_pass_yield_pct: 75.42,
      scrap_rate_pct: 24.58,
      capacity_retention_pct: 89.1,
      co2_intensity_kg_per_kwh: 60.4,
      committed_value_lost_eur: 17_364,
    },
  ],
  parameters: [
    {
      parameter: 'porosity_pct',
      unit: '%',
      lower_limit: 30,
      upper_limit: 35,
      target: 32.5,
      points: [
        { started_at: '2026-07-01T06:00:00Z', value: 31.8 },
        { started_at: '2026-07-20T06:00:00Z', value: 32.4 },
      ],
    },
  ],
};

/**
 * Two endpoints, two fragments.
 *
 * Keyed on the full path rather than on `/metrics`: the dashboard now fires
 * `/metrics/overview` and `/metrics/trend` in parallel, and a single `/metrics`
 * handler answers both with the same body. That fails loudly here — the trend
 * payload has no `points` — but the shape of the mistake is the quiet kind, so
 * it is worth naming: a fragment that matches more than one route makes a test
 * assert against a payload the API would never send.
 */
const mockFetch = (body: unknown, ok = true, trend: unknown = TREND): void => {
  mockFetchJson({ '/metrics/overview': body, '/metrics/trend': trend }, ok);
};

/**
 * The readings band, as a region.
 *
 * It is labelled by its own visible heading, which is what lets an assertion
 * say "the label in the readings band" rather than "the first element with this
 * text" — a distinction that matters now four charts name the same
 * measurements. The heading used to be `sr-only` and to repeat the page title;
 * once the charts moved in front of it that was both a duplicate announcement
 * and an untitled strip on screen.
 */
const readingsBand = (name = 'Where the line stands today'): HTMLElement =>
  screen.getByRole('region', { name });

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
    // Scoped to the headline band. "First-pass yield" is also a column heading
    // in the trend chart's table now, and an unscoped query would pass today by
    // accident and fail the next time a chart names the same measurement.
    expect(within(readingsBand()).getByText('First-pass yield')).toBeInTheDocument();
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

    await screen.findByText('Where the scrap happened');
    const scrap = screen.getByRole('region', { name: 'Where the scrap happened' });

    // Scoped: every chart on the page carries its own disclosure now, which is
    // the point — but it means "the table" is ambiguous and this test is about
    // the scrap breakdown's one specifically.
    const disclosure = within(scrap).getAllByText('Show the data as a table')[0];
    await userEvent.click(disclosure as HTMLElement);

    // Addressed by its caption, which is the table's accessible name. The
    // section holds two tables — the rate breakdown and the cost breakdown —
    // and they deliberately share a column heading, so the caption is the only
    // thing that tells them apart.
    expect(
      within(scrap).getByRole('table', { name: 'Scrap rate by process step' }),
    ).toBeInTheDocument();
  });

  it('gives every chart on the page a table behind it', async () => {
    // The rule the whole chart layer is built on: the drawing is aria-hidden
    // and the table is the authoritative rendering. A chart added without one
    // is a chart that is invisible to a screen reader, and nothing else on the
    // page would notice.
    mockFetch(OVERVIEW);
    renderWithProviders(<DashboardView locale="en" />);

    await screen.findByText('How it got here');

    // Scrap rate, scrap cost, yield trend, throughput, and one control chart.
    expect(screen.getAllByText('Show the data as a table')).toHaveLength(5);
    expect(screen.getAllByRole('table')).toHaveLength(5);
  });

  it('states what the window cost and how the line compares to its peers', async () => {
    mockFetch(OVERVIEW);
    renderWithProviders(<DashboardView locale="en" />);

    // The money, and the benchmark that answers "am I good" rather than "am I
    // in spec" — which is the question Beff's platform actually exists to
    // answer, and the one a specification window cannot.
    // An explicit timeout, because the charts now mount *before* this row.
    // `findBy` defaults to 1s, and five ECharts instances constructing in jsdom
    // under `maxWorkers: 2` can eat that on their own — the same environment
    // contention `vitest.config.ts` documents. It failed exactly once, only
    // when run alongside another chart file, which is the shape of a flake
    // rather than a regression.
    expect(await screen.findByText('€34,764', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('+3.7 pp')).toBeInTheDocument();
    expect(screen.getByText(/Median of 34 pilot lines/)).toBeInTheDocument();
  });

  it('draws the trend charts from the trend query, not the overview', async () => {
    mockFetch(OVERVIEW);
    renderWithProviders(<DashboardView locale="en" />);

    expect(
      await screen.findByRole('heading', { name: 'First-pass yield, batch by batch' }),
    ).toBeInTheDocument();
    // A batch code that appears only in the trend payload, so this assertion
    // cannot pass on the overview's data. Twice: the yield chart and the
    // throughput chart plot the same batches, which is exactly why they sit
    // side by side.
    expect(screen.getAllByRole('rowheader', { name: 'B-2026-002' })).toHaveLength(2);
  });

  it('keeps the headline figures when only the trend fails', async () => {
    // Two queries, two failures. A trend that 500s must not blank the four
    // readings that already arrived — which is the entire reason it is a second
    // request rather than more fields on the first.
    // A real failure — a 500 — not an unmatched route. React Query leaves
    // `data` undefined on error, which is the state the component guards on;
    // an unmatched route in `mockFetchJson` resolves 200 with a `null` body,
    // which is a shape the API cannot produce and would test nothing.
    mockRoutes({
      '/metrics/overview': { status: 200, body: OVERVIEW },
      '/metrics/trend': { status: 500, body: { detail: 'boom' } },
    });
    renderWithProviders(<DashboardView locale="en" />);

    expect(
      await screen.findByText(/71\.7\s*% — in spec\. Specification 40\.0–80\.0 %/),
    ).toBeInTheDocument();
    expect(screen.queryByText('How it got here')).not.toBeInTheDocument();
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

    await screen.findByText('Wo der Ausschuss entstanden ist');

    expect(
      within(readingsBand('Wo die Linie heute steht')).getByText('Erstdurchlaufquote'),
    ).toBeInTheDocument();
    // And the charts, which carry their own strings and would have been the
    // place an English default survived unnoticed.
    expect(
      screen.getByRole('heading', { name: 'Erstdurchlaufquote je Charge' }),
    ).toBeInTheDocument();
    // Named in three places — the KPI label, the cost chart's heading and its
    // column heading — which is the point: one German term, used consistently.
    expect(screen.getAllByText('Verlorene gebundene Wertschöpfung').length).toBeGreaterThan(1);
  });
});
