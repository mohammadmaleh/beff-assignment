import { describe, expect, it } from 'vitest';

import { sortRows } from './model';

import type { DataColumn } from './types';

interface Batch {
  code: string;
  cells: number;
}

const ROWS: Batch[] = [
  { code: 'B-003', cells: 9 },
  { code: 'B-001', cells: 100 },
  { code: 'B-002', cells: 42 },
];

const COLUMNS: DataColumn<Batch>[] = [
  {
    key: 'code',
    header: 'Batch',
    render: (row) => row.code,
    text: (row) => row.code,
    sortValue: (row) => row.code,
  },
  {
    key: 'cells',
    header: 'Cells',
    render: (row) => String(row.cells),
    text: (row) => String(row.cells),
    sortValue: (row) => row.cells,
  },
  { key: 'note', header: 'Note', render: () => '—', text: () => '—' },
];

describe('sortRows', () => {
  it('sorts numerically rather than lexically', () => {
    // The whole reason `sortValue` may return a number. Sorted as strings,
    // '100' comes before '9' and the column silently lies.
    const sorted = sortRows(ROWS, COLUMNS, { key: 'cells', direction: 'ascending' });

    expect(sorted.map((row) => row.cells)).toEqual([9, 42, 100]);
  });

  it('reverses on descending', () => {
    const sorted = sortRows(ROWS, COLUMNS, { key: 'cells', direction: 'descending' });

    expect(sorted.map((row) => row.cells)).toEqual([100, 42, 9]);
  });

  it('sorts strings by locale comparison', () => {
    const sorted = sortRows(ROWS, COLUMNS, { key: 'code', direction: 'ascending' });

    expect(sorted.map((row) => row.code)).toEqual(['B-001', 'B-002', 'B-003']);
  });

  it('returns payload order when nothing is sorted', () => {
    // "No sort" is a real state, not the absence of one: for the batch tables
    // payload order is chronological, and that is itself information.
    expect(sortRows(ROWS, COLUMNS, null)).toEqual(ROWS);
  });

  it('leaves the rows alone when the column cannot be sorted', () => {
    expect(sortRows(ROWS, COLUMNS, { key: 'note', direction: 'ascending' })).toEqual(ROWS);
  });

  it('does not mutate the rows it was given', () => {
    const original = [...ROWS];
    sortRows(ROWS, COLUMNS, { key: 'cells', direction: 'descending' });

    expect(ROWS).toEqual(original);
  });
});
