import type { ReactNode } from 'react';

/** Which way a sorted column is ordered. Matches the `aria-sort` token exactly. */
export type SortDirection = 'ascending' | 'descending';

export interface SortState {
  /** `DataColumn.key` of the sorted column. */
  key: string;
  direction: SortDirection;
}

/**
 * Every filter input's raw value. Strings, not numbers or dates, because an
 * empty input means *unbounded* and `0` is a legitimate bound - `number | null`
 * would make the component responsible for telling those apart on every render.
 */
export interface FilterState {
  search: string;
  /** Raw `<input type="number">` value. `''` is unbounded. */
  min: string;
  max: string;
  /** Raw `<input type="date">` value, `YYYY-MM-DD`. `''` is unbounded. */
  from: string;
  to: string;
}

export interface DataColumn<Row> {
  /** Stable id. Sort-state key and CSV header key. Never displayed. */
  key: string;
  /** Translated header text. Required - no default. */
  header: string;
  align?: 'start' | 'end';
  /** The first column of each table, rendered as `<th scope="row">`. */
  rowHeader?: boolean;

  /** The formatted cell. Locale formatting has already happened here. */
  render: (row: Row) => ReactNode;
  /**
   * Plain text of the same cell, for search matching and CSV.
   *
   * Separate from `render` so both read what the user *sees* - `88.3 %`, not
   * `88.3248275862069`. Full `NUMERIC` precision has reached a payload in this
   * project once already; the export must not reintroduce it.
   */
  text: (row: Row) => string;

  /**
   * Comparable value. Absent → the column is not sortable.
   *
   * Return a `number` wherever the value is numeric. Sorting the rendered
   * string puts `100` before `9`, and puts `1 400` - with the locale's thin
   * space - nowhere sensible at all.
   */
  sortValue?: (row: Row) => number | string;
  /** At most one per table. Its presence is what draws the min/max inputs. */
  filterRange?: (row: Row) => number;
  /** At most one per table. ISO 8601. Its presence draws the from/to inputs. */
  filterDate?: (row: Row) => string;
  /** Renders the cell as a shaped badge. The label is the signal, not the colour. */
  badge?: (row: Row) => { label: string; intent: 'neutral' | 'danger' };
}

/**
 * Every string the table can show. All required, none defaulted - the same rule
 * `SpecBand` established after the German landing page announced the product's
 * signature element entirely in English.
 */
export interface DataTableCopy {
  search: string;
  searchPlaceholder: string;
  rangeMin: string;
  rangeMax: string;
  dateFrom: string;
  dateTo: string;
  reset: string;
  exportCsv: string;
  /** `'Showing {shown} of {total}'` */
  summary: string;
  empty: string;
  /** `'Sorted by {column}, ascending'` */
  sortedAscending: string;
  sortedDescending: string;
  /** `'Sorting cleared, {column}'` */
  sortCleared: string;
}
