import { DataTable } from './DataTable';

import type { DataTableProps } from './DataTable';
import type { DataColumn, DataTableCopy } from './types';
import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * The authoritative rendering of a chart's numbers, as something an engineer
 * can actually work: sortable, filterable, exportable.
 *
 * ## It takes column *descriptors*, not markup
 *
 * That is the whole point. Six charts previously handed the figure six
 * hand-rolled `<tbody>` blobs, and markup cannot be sorted — so nothing shared
 * could exist even in principle. A `DataColumn` splits `render` (what the
 * reader sees) from `text` (what search matches and what the CSV carries) from
 * `sortValue` (what actually compares), and each of those three is a different
 * job that looks like the same one until a `100` sorts before a `9`.
 *
 * ## `locale` is a plain string
 *
 * Only used to pick the CSV delimiter, and the rule underneath is not
 * "German": Excel uses `;` wherever the locale's decimal separator is a comma,
 * because a comma cannot be both. Asking `Intl` that question keeps this
 * component free of any app's list of shipped locales.
 */
interface Batch {
  batch: string;
  started: string;
  yieldPct: number;
  cells: number;
}

const ROWS: Batch[] = [
  { batch: 'B-2026-041', started: '2026-06-02', yieldPct: 68.2, cells: 1180 },
  { batch: 'B-2026-042', started: '2026-06-09', yieldPct: 71.8, cells: 1340 },
  { batch: 'B-2026-043', started: '2026-06-16', yieldPct: 74.1, cells: 1290 },
  { batch: 'B-2026-044', started: '2026-06-23', yieldPct: 65.4, cells: 940 },
  { batch: 'B-2026-045', started: '2026-06-30', yieldPct: 77.6, cells: 1400 },
];

/*
 * Formatters built per locale, and the columns with them.
 *
 * Cells arrive at the table *already formatted* — the component never sees a
 * raw number except through `sortValue` and `filterRange`. So a German story
 * that reused English-formatted columns would show `71.8%` beside a semicolon
 * delimiter and quietly misrepresent what the component does.
 */
function columnsFor(locale: string): DataColumn<Batch>[] {
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const count = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  const yieldText = (row: Batch): string => percent.format(row.yieldPct / 100);
  const startedText = (row: Batch): string => date.format(new Date(row.started));
  const cellsText = (row: Batch): string => count.format(row.cells);

  return [
    {
      key: 'batch',
      header: locale === 'de' ? 'Charge' : 'Batch',
      rowHeader: true,
      render: (row) => row.batch,
      text: (row) => row.batch,
      sortValue: (row) => row.batch,
    },
    {
      key: 'started',
      header: locale === 'de' ? 'Gestartet' : 'Started',
      render: startedText,
      text: startedText,
      // Sorted and filtered on the ISO instant, never the formatted date:
      // "15 Jun" sorts before "1 Jul" as a string, and German sorts differently
      // again.
      sortValue: (row) => row.started,
      filterDate: (row) => row.started,
    },
    {
      key: 'yield',
      header: locale === 'de' ? 'Ausbeute' : 'First-pass yield',
      align: 'end',
      render: yieldText,
      text: yieldText,
      // The number, never the formatted string — '9.0%' sorts after '100.0%'.
      sortValue: (row) => row.yieldPct,
      filterRange: (row) => row.yieldPct,
    },
    {
      key: 'cells',
      header: locale === 'de' ? 'Zellen gestartet' : 'Cells started',
      align: 'end',
      render: cellsText,
      text: cellsText,
      sortValue: (row) => row.cells,
    },
  ];
}

const COLUMNS = columnsFor('en');

/**
 * Every string the table can show, and all of them required. Same rule
 * `SpecBand` established: a component library cannot know the page's language,
 * so a default is a guess that ships.
 */
const COPY: DataTableCopy = {
  search: 'Search',
  searchPlaceholder: 'Batch code…',
  rangeMin: 'Minimum',
  rangeMax: 'Maximum',
  dateFrom: 'From',
  dateTo: 'To',
  reset: 'Reset filters',
  exportCsv: 'Download CSV',
  summary: 'Showing {shown} of {total}',
  empty: 'No batches match these filters.',
  sortedAscending: 'Sorted by {column}, ascending',
  sortedDescending: 'Sorted by {column}, descending',
  sortCleared: 'Sorting cleared, {column}',
};

/*
 * A concrete instantiation, because `DataTable` is generic in its row type and
 * Storybook's `Meta` is not. Handing it the generic function directly infers
 * `DataColumn<unknown>` for every arg, and the whole point of the column
 * descriptors is that they are typed against the row.
 */
function BatchTable(props: DataTableProps<Batch>) {
  return <DataTable<Batch> {...props} />;
}

const meta = {
  title: 'Data/DataTable',
  component: BatchTable,
  parameters: { layout: 'fullscreen' },
  args: {
    caption: 'First-pass yield by batch, last five windows',
    columns: COLUMNS,
    rows: ROWS,
    rowKey: (row: Batch) => row.batch,
    locale: 'en',
    csvName: 'beff-first-pass-yield',
    copy: COPY,
  },
} satisfies Meta<typeof BatchTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Click a header to sort: ascending → descending → unsorted. `aria-sort` is set
 * only on sortable columns — on an unsortable one it would claim an affordance
 * that is not there — and the change is mirrored into a live region, because
 * reordering rows is otherwise completely silent.
 */
export const Default: Story = {};

/**
 * The range inputs' placeholders are the observed low and high, formatted by
 * the column's own `text`. An empty bounded control is otherwise a box with a
 * dash in it, and "what range is even available?" is the question a reader has
 * *before* they can pick a bound.
 *
 * Each filter group is a `<fieldset>` captioned by the **column's** header. The
 * first version said `From`/`To` and nothing else — the same two words meaning
 * per cent here, cells on throughput, euros on scrap cost and Wh/kg on a
 * control chart.
 */
export const FilteredToOneWindow: Story = {
  args: { rows: ROWS.slice(1, 3) },
};

/** A filter that matches nothing says so, rather than rendering an empty grid. */
export const Empty: Story = { args: { rows: [] } };

/**
 * A badge **replaces** the cell rather than decorating it, and carries its label
 * as a word inside the pill — the same rule the drawing's red marker follows.
 * Bordered rather than filled: there is no `status-danger-bg` token, and a
 * filled pill would mean inventing a colour pair the contrast gate has never
 * solved.
 */
export const WithVerdictBadges: Story = {
  args: {
    caption: 'Electrode porosity, batch by batch',
    columns: [
      ...columnsFor('en').slice(0, 3),
      {
        key: 'verdict',
        header: 'Verdict',
        render: () => null,
        text: (row: Batch) => (row.yieldPct < 68 ? 'Out of spec' : 'In spec'),
        sortValue: (row: Batch) => (row.yieldPct < 68 ? 1 : 0),
        badge: (row: Batch) =>
          row.yieldPct < 68
            ? { label: 'Out of spec', intent: 'danger' as const }
            : { label: 'In spec', intent: 'neutral' as const },
      },
    ],
  },
};

/**
 * German. The delimiter flips to `;` for Excel, the numbers take a comma
 * decimal separator, and `71,8 %` gets the **non-breaking** space before the
 * sign that `Intl` supplies and a template literal does not.
 */
export const German: Story = {
  args: {
    locale: 'de',
    columns: columnsFor('de'),
    caption: 'Ausbeute im ersten Durchlauf je Charge',
    copy: {
      ...COPY,
      search: 'Suche',
      searchPlaceholder: 'Chargennummer…',
      rangeMin: 'Minimum',
      rangeMax: 'Maximum',
      dateFrom: 'Von',
      dateTo: 'Bis',
      reset: 'Filter zurücksetzen',
      exportCsv: 'CSV herunterladen',
      summary: '{shown} von {total} werden angezeigt',
      empty: 'Keine Chargen entsprechen diesen Filtern.',
    },
  },
};
