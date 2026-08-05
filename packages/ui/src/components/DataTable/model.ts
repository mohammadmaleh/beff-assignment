import type { DataColumn, FilterState, SortState } from './types';

/**
 * Rows in the order a sort asks for.
 *
 * `Array.prototype.sort` is stable in every engine this ships to, so rows that
 * compare equal keep payload order — which for the batch tables is
 * chronological, and is the tie-break a reader expects without being told.
 */
export function sortRows<Row>(
  rows: readonly Row[],
  columns: readonly DataColumn<Row>[],
  sort: SortState | null,
): readonly Row[] {
  if (sort === null) return rows;

  const sortValue = columns.find((column) => column.key === sort.key)?.sortValue;
  if (sortValue === undefined) return rows;

  const factor = sort.direction === 'ascending' ? 1 : -1;

  return [...rows].sort((left, right) => {
    const a = sortValue(left);
    const b = sortValue(right);

    // Numbers compared as numbers. This branch is the column's whole reason for
    // returning one: '100' sorts before '9' as a string, and a yield column
    // that does that is worse than an unsorted one, because it looks sorted.
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * factor;

    return String(a).localeCompare(String(b)) * factor;
  });
}

export const EMPTY_FILTERS: FilterState = {
  search: '',
  min: '',
  max: '',
  from: '',
  to: '',
};

export function hasActiveFilter(filters: FilterState): boolean {
  return Object.values(filters).some((value) => value !== '');
}

/** A bound the user has actually set, or `null` for unbounded. */
function bound(raw: string): number | null {
  if (raw === '') return null;
  const value = Number(raw);
  // A partial entry ('-', '1e') is `NaN`, and every comparison against NaN is
  // false — which would empty the table mid-keystroke and read as a bug.
  return Number.isNaN(value) ? null : value;
}

/**
 * The rows that survive every active filter.
 *
 * Dates are compared as ISO day strings rather than as `Date` objects. `'2026-02-08'
 * <= '2026-03-10'` is exactly correct lexically, needs no parsing, and cannot
 * shift a batch across a day boundary because the browser and the server
 * disagree about a timezone.
 */
export function applyFilters<Row>(
  rows: readonly Row[],
  columns: readonly DataColumn<Row>[],
  filters: FilterState,
): readonly Row[] {
  const needle = filters.search.trim().toLocaleLowerCase();
  const range = columns.find((column) => column.filterRange !== undefined)?.filterRange;
  const date = columns.find((column) => column.filterDate !== undefined)?.filterDate;
  const min = bound(filters.min);
  const max = bound(filters.max);

  return rows.filter((row) => {
    if (
      needle !== '' &&
      !columns.some((column) => column.text(row).toLocaleLowerCase().includes(needle))
    ) {
      return false;
    }

    if (range !== undefined) {
      const value = range(row);
      // Inclusive on both sides. A reading sitting exactly on a limit is the
      // one a process engineer came looking for.
      if (min !== null && value < min) return false;
      if (max !== null && value > max) return false;
    }

    if (date !== undefined) {
      const day = date(row).slice(0, 10);
      if (filters.from !== '' && day < filters.from) return false;
      if (filters.to !== '' && day > filters.to) return false;
    }

    return true;
  });
}
