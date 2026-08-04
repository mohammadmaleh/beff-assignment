import type { DataColumn, SortState } from './types';

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
