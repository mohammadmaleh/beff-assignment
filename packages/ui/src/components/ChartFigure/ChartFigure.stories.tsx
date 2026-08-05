import { DataTable } from '../DataTable/index';

import { ChartFigure } from './ChartFigure';
import { ChartViews } from './ChartViews';

import type { DataColumn, DataTableCopy } from '../DataTable/index';
import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * The frame every chart in this system is mounted in.
 *
 * ## The inversion
 *
 * The drawing is `aria-hidden` and the `<table>` beside it is **not** an
 * alternative bolted on for compliance — it is the authoritative rendering, and
 * the drawing is a fast visual index into it. A chart built that way cannot
 * drift out of sync with its own description, because there is only one set of
 * numbers and the table is it.
 *
 * ## Why a tablist and not `<details>`
 *
 * `<details>` was defensible while the table was disclosed on demand. It stops
 * being defensible once the table is the authoritative rendering: a grey line
 * of text under a hairline rule said "extra" to everyone who could see it,
 * while the docstring said the opposite. A tablist names both views equally and
 * states which one is showing. Arrow keys move between the tabs and select as
 * they go, per the APG pattern; the tablist is named by the figure's own
 * caption, because several of these appear on one page and "Chart / Table"
 * alone does not say which figure.
 *
 * ## `title` and `description` are required strings
 *
 * With the drawing hidden, the caption is the chart's entire announced identity
 * above the table. A default would ship an English caption onto the German
 * dashboard, and nothing would catch it.
 */
interface Step {
  step: string;
  ratePct: number;
}

const ROWS: Step[] = [
  { step: 'Mixing', ratePct: 0.4 },
  { step: 'Coating', ratePct: 2.1 },
  { step: 'Calendering', ratePct: 1.2 },
  { step: 'Slitting', ratePct: 0.7 },
  { step: 'Formation', ratePct: 1.9 },
];

const percent = new Intl.NumberFormat('en', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const COLUMNS: DataColumn<Step>[] = [
  {
    key: 'step',
    header: 'Process step',
    rowHeader: true,
    render: (row) => row.step,
    text: (row) => row.step,
    sortValue: (row) => row.step,
  },
  {
    key: 'rate',
    header: 'Scrap rate',
    align: 'end',
    render: (row) => percent.format(row.ratePct / 100),
    text: (row) => percent.format(row.ratePct / 100),
    sortValue: (row) => row.ratePct,
    filterRange: (row) => row.ratePct,
  },
];

const COPY: DataTableCopy = {
  search: 'Search',
  searchPlaceholder: 'Process step…',
  rangeMin: 'Minimum',
  rangeMax: 'Maximum',
  dateFrom: 'From',
  dateTo: 'To',
  reset: 'Reset filters',
  exportCsv: 'Download CSV',
  summary: 'Showing {shown} of {total}',
  empty: 'No steps match these filters.',
  sortedAscending: 'Sorted by {column}, ascending',
  sortedDescending: 'Sorted by {column}, descending',
  sortCleared: 'Sorting cleared, {column}',
};

/**
 * A stand-in for the real drawing. Bars rather than an ECharts canvas so the
 * story stays about the *frame* — and `aria-hidden`, which is the rule this
 * figure is built on.
 */
function Bars({ rows }: { rows: readonly Step[] }) {
  const worst = Math.max(...rows.map((row) => row.ratePct), 1);
  return (
    <ul aria-hidden="true" className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.step} className="grid grid-cols-[8rem_1fr_4rem] items-center gap-3">
          <span className="text-text-muted truncate text-[length:var(--type-ui-size-sm)]">
            {row.step}
          </span>
          <span className="bg-surface-sunken block h-4">
            <span
              className="bg-chart-series-2 block h-4"
              style={{ inlineSize: `${String((row.ratePct / worst) * 100)}%` }}
            />
          </span>
          <span className="text-end text-[length:var(--type-ui-size-sm)] tabular-nums">
            {percent.format(row.ratePct / 100)}
          </span>
        </li>
      ))}
    </ul>
  );
}

const meta = {
  title: 'Charts/ChartFigure',
  component: ChartFigure,
  parameters: { layout: 'fullscreen' },
  args: {
    id: 'scrap-by-step',
    title: 'Scrap by process step',
    description: 'The share of cells lost at each step, in process order rather than by size.',
    viewChartLabel: 'Chart',
    viewTableLabel: 'Table',
    chart: <Bars rows={ROWS} />,
    table: (
      <DataTable
        caption="Scrap rate by process step"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.step}
        locale="en"
        csvName="beff-scrap-by-step"
        copy={COPY}
      />
    ),
  },
} satisfies Meta<typeof ChartFigure>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch to Table and back. Both panels are `tabIndex={0}` so a keyboard user can scroll them. */
export const Default: Story = {};

/** `h2` where the figure opens a section rather than sitting inside one. */
export const SectionLevel: Story = { args: { headingLevel: 'h2' } };

/**
 * Two on one page, which is the case the `id` prop exists for: `ChartFigure`
 * derives four DOM ids from it — the heading, the tablist's `aria-labelledby`,
 * and one `id`/`aria-controls` pair per panel. Collide them and two figures
 * claim the same panel: a screen reader announces the wrong one, and every
 * automated check still passes because the markup is well formed.
 */
export const TwoOnAPage: Story = {
  render: (args) => (
    <div className="flex flex-col gap-16">
      <ChartFigure {...args} id="scrap-rate" />
      <ChartFigure
        {...args}
        id="scrap-cost"
        title="Committed value lost by step"
        description="The same steps, priced. Its tallest bar is not the tallest bar above."
      />
    </div>
  ),
};

/**
 * `ChartViews` on its own — the switch and the two panels, without the
 * `<figure>` and `<figcaption>`.
 *
 * It is separate because two figures need the switch and they caption
 * themselves differently: the dashboard wants a real heading at the caller's
 * level, the landing page's cost figure wants its uppercase data-font label,
 * which is a deliberate marketing treatment rather than an inconsistency to be
 * normalised away. Sharing the switch and not the caption is what lets both be
 * true — and it means the APG keyboard behaviour is implemented once.
 *
 * It returns a fragment, not a wrapper: `<figcaption>` must be the first or last
 * child of `<figure>`, and a wrapper between them breaks the figure's
 * accessible name.
 */
export const ViewsAlone: Story = {
  render: (args) => (
    <figure className="m-0 grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_auto]">
      <figcaption className="flex flex-col gap-1">
        <span
          id="cost-of-position"
          className="text-text-muted font-(family-name:--type-family-data) text-[length:var(--type-ui-size-xs)] tracking-[0.14em] uppercase"
        >
          Committed value by position
        </span>
      </figcaption>
      <ChartViews
        id="cost-of-position-views"
        labelledBy="cost-of-position"
        viewChartLabel={args.viewChartLabel}
        viewTableLabel={args.viewTableLabel}
        chart={args.chart}
        table={args.table}
      />
    </figure>
  ),
};
