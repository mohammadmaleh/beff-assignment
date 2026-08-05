import { describe, expect, it } from 'vitest';

import { applyFilters, EMPTY_FILTERS, hasActiveFilter, sortRows } from './model';

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

  it('preserves payload order for equal sort values (stable sort, ascending)', () => {
    // Two batches with the same yield preserve their original order when sorted.
    // This is the tie-break behavior: payload order is chronological and matters.
    const tiedRows: Batch[] = [
      { code: 'B-A', cells: 50 },
      { code: 'B-B', cells: 50 },
      { code: 'B-C', cells: 100 },
    ];

    const sorted = sortRows(tiedRows, COLUMNS, { key: 'cells', direction: 'ascending' });

    expect(sorted.map((row) => row.code)).toEqual(['B-A', 'B-B', 'B-C']);
  });

  it('preserves payload order for equal sort values (stable sort, descending)', () => {
    // Same tie-break check in the opposite direction.
    const tiedRows: Batch[] = [
      { code: 'B-A', cells: 50 },
      { code: 'B-B', cells: 50 },
      { code: 'B-C', cells: 100 },
    ];

    const sorted = sortRows(tiedRows, COLUMNS, { key: 'cells', direction: 'descending' });

    expect(sorted.map((row) => row.code)).toEqual(['B-C', 'B-A', 'B-B']);
  });
});

interface Reading {
  code: string;
  value: number;
  measured: string;
}

const READINGS: Reading[] = [
  { code: 'B-001', value: 10, measured: '2026-01-04T08:00:00Z' },
  { code: 'B-002', value: 20, measured: '2026-02-08T08:00:00Z' },
  { code: 'B-003', value: 30, measured: '2026-03-10T08:00:00Z' },
];

const READING_COLUMNS: DataColumn<Reading>[] = [
  { key: 'code', header: 'Batch', render: (row) => row.code, text: (row) => row.code },
  {
    key: 'value',
    header: 'Value',
    render: (row) => String(row.value),
    text: (row) => String(row.value),
    filterRange: (row) => row.value,
  },
  {
    key: 'measured',
    header: 'Measured',
    render: (row) => row.measured,
    text: (row) => row.measured,
    filterDate: (row) => row.measured,
  },
];

describe('applyFilters', () => {
  it('returns everything when nothing is filtered', () => {
    expect(applyFilters(READINGS, READING_COLUMNS, EMPTY_FILTERS)).toEqual(READINGS);
  });

  it('matches the search against any column, case-insensitively', () => {
    const found = applyFilters(READINGS, READING_COLUMNS, { ...EMPTY_FILTERS, search: 'b-002' });

    expect(found.map((row) => row.code)).toEqual(['B-002']);
  });

  it('treats the range bounds as inclusive', () => {
    // A reading sitting exactly on the bound is in the range. Exclusive bounds
    // silently drop the readings a process engineer is most interested in.
    const found = applyFilters(READINGS, READING_COLUMNS, {
      ...EMPTY_FILTERS,
      min: '10',
      max: '20',
    });

    expect(found.map((row) => row.value)).toEqual([10, 20]);
  });

  it('leaves one side of the range unbounded when it is blank', () => {
    const found = applyFilters(READINGS, READING_COLUMNS, { ...EMPTY_FILTERS, min: '20' });

    expect(found.map((row) => row.value)).toEqual([20, 30]);
  });

  it('ignores a range bound that is not a number', () => {
    // `<input type="number">` can hold '' or a partial entry like '-'. Number('-')
    // is NaN, and every comparison against NaN is false — which would silently
    // return zero rows and read as a broken table.
    const found = applyFilters(READINGS, READING_COLUMNS, { ...EMPTY_FILTERS, min: '-' });

    expect(found).toHaveLength(3);
  });

  it('filters by date inclusively, comparing the ISO day', () => {
    const found = applyFilters(READINGS, READING_COLUMNS, {
      ...EMPTY_FILTERS,
      from: '2026-02-08',
      to: '2026-03-10',
    });

    expect(found.map((row) => row.code)).toEqual(['B-002', 'B-003']);
  });

  it('combines the filters rather than letting the last one win', () => {
    const found = applyFilters(READINGS, READING_COLUMNS, {
      ...EMPTY_FILTERS,
      search: 'B-0',
      min: '25',
    });

    expect(found.map((row) => row.code)).toEqual(['B-003']);
  });
});

describe('hasActiveFilter', () => {
  it('is false for the empty state', () => {
    expect(hasActiveFilter(EMPTY_FILTERS)).toBe(false);
  });

  it('is true as soon as any one field is set', () => {
    expect(hasActiveFilter({ ...EMPTY_FILTERS, to: '2026-03-10' })).toBe(true);
  });
});
