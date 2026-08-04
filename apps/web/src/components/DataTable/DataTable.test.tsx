import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DataTable } from './DataTable';

import type { DataColumn, DataTableCopy } from './types';

interface Batch {
  code: string;
  started: string;
  yieldPct: number;
}

const ROWS: Batch[] = [
  { code: 'B-003', started: '2026-03-10T08:00:00Z', yieldPct: 9 },
  { code: 'B-001', started: '2026-01-04T08:00:00Z', yieldPct: 100 },
  { code: 'B-002', started: '2026-02-08T08:00:00Z', yieldPct: 42 },
];

const COPY: DataTableCopy = {
  search: 'Search',
  searchPlaceholder: 'Batch or step',
  rangeMin: 'Minimum',
  rangeMax: 'Maximum',
  dateFrom: 'From',
  dateTo: 'To',
  reset: 'Reset filters',
  exportCsv: 'Export CSV',
  summary: 'Showing {shown} of {total}',
  empty: 'No rows match these filters.',
  sortedAscending: 'Sorted by {column}, ascending',
  sortedDescending: 'Sorted by {column}, descending',
  sortCleared: 'Sorting cleared, {column}',
};

const COLUMNS: DataColumn<Batch>[] = [
  {
    key: 'code',
    header: 'Batch',
    rowHeader: true,
    render: (row) => row.code,
    text: (row) => row.code,
    sortValue: (row) => row.code,
  },
  {
    key: 'yield',
    header: 'Yield',
    align: 'end',
    render: (row) => `${String(row.yieldPct)}%`,
    text: (row) => `${String(row.yieldPct)}%`,
    sortValue: (row) => row.yieldPct,
    filterRange: (row) => row.yieldPct,
  },
  {
    key: 'started',
    header: 'Started',
    render: (row) => row.started.slice(0, 10),
    text: (row) => row.started.slice(0, 10),
    filterDate: (row) => row.started,
  },
];

function renderTable() {
  return render(
    <DataTable
      caption="Yield by batch"
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(row) => row.code}
      locale="en"
      csvName="yield"
      copy={COPY}
    />,
  );
}

/** The batch code of every body row, in the order they are rendered. */
function renderedCodes(): string[] {
  const body = screen.getAllByRole('rowgroup')[1] as HTMLElement;
  return within(body)
    .getAllByRole('rowheader')
    .map((cell) => cell.textContent ?? '');
}

describe('DataTable', () => {
  it('names the table with its caption', () => {
    renderTable();

    expect(screen.getByRole('table')).toHaveAccessibleName('Yield by batch');
  });

  it('renders the first column as a row header, not a plain cell', () => {
    renderTable();

    expect(screen.getByRole('rowheader', { name: 'B-001' })).toBeInTheDocument();
  });

  it('starts unsorted, in payload order', () => {
    renderTable();

    expect(renderedCodes()).toEqual(['B-003', 'B-001', 'B-002']);
    expect(screen.getByRole('columnheader', { name: /Yield/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });

  it('cycles a column ascending, descending, then back to payload order', async () => {
    const user = userEvent.setup();
    renderTable();

    const header = screen.getByRole('columnheader', { name: /Yield/ });
    const button = within(header).getByRole('button');

    await user.click(button);
    expect(renderedCodes()).toEqual(['B-003', 'B-002', 'B-001']);
    expect(header).toHaveAttribute('aria-sort', 'ascending');

    await user.click(button);
    expect(renderedCodes()).toEqual(['B-001', 'B-002', 'B-003']);
    expect(header).toHaveAttribute('aria-sort', 'descending');

    await user.click(button);
    expect(renderedCodes()).toEqual(['B-003', 'B-001', 'B-002']);
    expect(header).toHaveAttribute('aria-sort', 'none');
  });

  it('marks only the sorted column, never two at once', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(
      within(screen.getByRole('columnheader', { name: /Yield/ })).getByRole('button'),
    );
    await user.click(
      within(screen.getByRole('columnheader', { name: /Batch/ })).getByRole('button'),
    );

    expect(screen.getByRole('columnheader', { name: /Batch/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(screen.getByRole('columnheader', { name: /Yield/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });

  it('announces the sort, because reordered rows are silent to a screen reader', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(
      within(screen.getByRole('columnheader', { name: /Yield/ })).getByRole('button'),
    );

    expect(screen.getByRole('status')).toHaveTextContent('Sorted by Yield, ascending');
  });

  it('gives a column with no sortValue no button at all', () => {
    renderTable();

    const header = screen.getByRole('columnheader', { name: 'Started' });
    expect(within(header).queryByRole('button')).toBeNull();
    expect(header).not.toHaveAttribute('aria-sort');
  });

  it('announces when a sort is cleared by clicking a third time', async () => {
    const user = userEvent.setup();
    renderTable();

    const header = screen.getByRole('columnheader', { name: /Yield/ });
    const button = within(header).getByRole('button');

    // First click: ascending
    await user.click(button);
    expect(screen.getByRole('status')).toHaveTextContent('Sorted by Yield, ascending');

    // Second click: descending
    await user.click(button);
    expect(screen.getByRole('status')).toHaveTextContent('Sorted by Yield, descending');

    // Third click: cleared, still names the column
    await user.click(button);
    expect(screen.getByRole('status')).toHaveTextContent('Sorting cleared, Yield');
  });
});

describe('DataTable filtering', () => {
  it('narrows the rows and says so, in one place a screen reader will hear', async () => {
    const user = userEvent.setup();
    renderTable();

    expect(screen.getByText('Showing 3 of 3')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Search/), 'B-002');

    expect(renderedCodes()).toEqual(['B-002']);
    expect(screen.getByText('Showing 1 of 3')).toBeInTheDocument();
  });

  it('offers a range pair because a column declared filterRange', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.type(screen.getByLabelText(/^Minimum/), '40');

    expect(renderedCodes()).toEqual(['B-001', 'B-002']);
  });

  it('offers a date pair because a column declared filterDate', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.type(screen.getByLabelText(/^From/), '2026-02-08');

    expect(renderedCodes()).toEqual(['B-003', 'B-002']);
  });

  it('shows an empty state rather than a headed table with no rows', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.type(screen.getByLabelText(/^Search/), 'nothing matches this');

    expect(screen.getByText('No rows match these filters.')).toBeInTheDocument();
    expect(screen.getByText('Showing 0 of 3')).toBeInTheDocument();
  });

  it('hides Reset until a filter is actually active', async () => {
    const user = userEvent.setup();
    renderTable();

    expect(screen.queryByRole('button', { name: 'Reset filters' })).toBeNull();

    await user.type(screen.getByLabelText(/^Search/), 'B-0');

    expect(screen.getByRole('button', { name: 'Reset filters' })).toBeInTheDocument();
  });

  it('clears the filters on reset and leaves the sort alone', async () => {
    // Two different pieces of state that look like one control cluster. Reset
    // that silently un-sorted the table would lose work the user did not ask
    // to undo.
    const user = userEvent.setup();
    renderTable();

    await user.click(
      within(screen.getByRole('columnheader', { name: /Yield/ })).getByRole('button'),
    );
    await user.type(screen.getByLabelText(/^Search/), 'B-00');
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));

    expect(renderedCodes()).toEqual(['B-003', 'B-002', 'B-001']);
    expect(screen.getByRole('columnheader', { name: /Yield/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });
});

describe('DataTable export', () => {
  it('exports what the user is looking at, not the unfiltered payload', async () => {
    /*
     * jsdom does implement `URL.createObjectURL`/`revokeObjectURL` here, but not
     * a real anchor navigation, so both are stubbed to observe the call rather
     * than actually download anything. The brief's own draft spread `URL` into a
     * plain object (`{ ...URL }`) to stub it — that loses the class's
     * non-enumerable statics (`canParse`, etc.) and, worse, produces something
     * that is no longer constructable: `new URL(...)` throws `TypeError: URL is
     * not a constructor` once that stub is active. Anything else touching `URL`
     * as a constructor during the test would fail far from this file. Since the
     * methods already exist natively in this jsdom, `vi.spyOn` on the real `URL`
     * object is both simpler and safe — it leaves the constructor intact.
     */
    const blobs: Blob[] = [];
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((obj) => {
      blobs.push(obj as Blob);
      return 'blob:stub';
    });
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const user = userEvent.setup();
    renderTable();

    await user.type(screen.getByLabelText(/^Search/), 'B-002');
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(click).toHaveBeenCalledOnce();
    expect(blobs).toHaveLength(1);

    /*
     * `Blob.text()` decodes via the WHATWG "UTF-8 decode" algorithm, which
     * strips a leading BOM by spec — in a real browser too, not only here. So
     * `text.startsWith('\uFEFF')` can never pass; the BOM only survives as raw
     * bytes. Check those directly (`EF BB BF`, UTF-8's BOM encoding), then
     * decode the rest for the content assertions.
     */
    const bytes = new Uint8Array(await (blobs[0] as Blob).arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);

    const text = await (blobs[0] as Blob).text();
    expect(text).toContain('Batch,Yield,Started');
    expect(text).toContain('B-002');
    expect(text).not.toContain('B-001');

    click.mockRestore();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });
});

describe('DataTable badges', () => {
  interface Reading {
    day: string;
    value: number;
    failed: boolean;
  }

  const READINGS: Reading[] = [
    { day: '2026-01-04', value: 31.2, failed: false },
    { day: '2026-02-08', value: 44.9, failed: true },
  ];

  const BADGE_COLUMNS: DataColumn<Reading>[] = [
    {
      key: 'day',
      header: 'Measured',
      rowHeader: true,
      render: (row) => row.day,
      text: (row) => row.day,
    },
    {
      key: 'verdict',
      header: 'Against spec',
      // The badge replaces the cell entirely; `text` is what search and the CSV
      // read, which is why it must still carry the word.
      render: () => null,
      text: (row) => (row.failed ? 'Out of spec' : 'In spec'),
      badge: (row) =>
        row.failed
          ? { label: 'Out of spec', intent: 'danger' }
          : { label: 'In spec', intent: 'neutral' },
    },
  ];

  function renderBadges() {
    return render(
      <DataTable
        caption="Porosity by batch"
        columns={BADGE_COLUMNS}
        rows={READINGS}
        rowKey={(row) => row.day}
        locale="en"
        csvName="porosity"
        copy={COPY}
      />,
    );
  }

  it('puts the verdict inside the badge as a word, never as colour alone', () => {
    // The same rule the red marker on the drawing follows: colour is the second
    // encoding. Roughly one man in twelve gets nothing from the fill, and a
    // greyscale printout gets nothing from it either.
    renderBadges();

    expect(screen.getByText('Out of spec')).toBeVisible();
    expect(screen.getByText('In spec')).toBeVisible();
  });

  it('marks the failing badge with a border as well as a colour', () => {
    renderBadges();

    expect(screen.getByText('Out of spec')).toHaveClass('border-status-danger-fg');
    expect(screen.getByText('In spec')).not.toHaveClass('border-status-danger-fg');
  });

  it('still exports and searches the badge text, not an empty cell', async () => {
    // `render` returns null for this column. If the search read `render`
    // instead of `text`, filtering on the verdict would silently match nothing.
    const user = userEvent.setup();
    renderBadges();

    await user.type(screen.getByLabelText(/^Search/), 'Out of spec');

    expect(screen.getByText('Showing 1 of 2')).toBeInTheDocument();
  });
});
