import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

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
});
