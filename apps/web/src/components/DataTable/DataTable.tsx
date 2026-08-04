'use client';

import { useMemo, useState } from 'react';

import { sortRows } from './model';

import type { DataColumn, DataTableCopy, SortState } from './types';
import type { Locale } from '@/lib/i18n';

export interface DataTableProps<Row> {
  /** The `<caption>`, which is the table's accessible name. */
  caption: string;
  columns: readonly DataColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** Only used for the CSV delimiter. Cell values arrive already formatted. */
  locale: Locale;
  /** Filename stem, e.g. `first-pass-yield`. */
  csvName: string;
  copy: DataTableCopy;
}

/** ascending → descending → unsorted, then round again. */
function nextSort(current: SortState | null, key: string): SortState | null {
  if (current === null || current.key !== key) return { key, direction: 'ascending' };
  if (current.direction === 'ascending') return { key, direction: 'descending' };
  return null;
}

/**
 * The authoritative rendering of a chart's numbers, as something an engineer
 * can actually work: sortable, filterable, exportable.
 *
 * It takes column *descriptors* rather than markup. That is the whole point —
 * six charts previously handed `ChartFigure` six hand-rolled `<tbody>` blobs,
 * and markup cannot be sorted, so nothing shared could exist even in principle.
 */
export function DataTable<Row>({ caption, columns, rows, rowKey, copy }: DataTableProps<Row>) {
  const [sort, setSort] = useState<SortState | null>(null);

  const visible = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);

  /*
   * Sorting reorders rows silently. A screen reader user gets no signal at all
   * unless one is spoken, so the state is mirrored here as a sentence.
   */
  const announcement = useMemo(() => {
    if (sort === null) return '';
    const header = columns.find((column) => column.key === sort.key)?.header ?? '';
    const template = sort.direction === 'ascending' ? copy.sortedAscending : copy.sortedDescending;
    return template.replace('{column}', header);
  }, [sort, columns, copy]);

  return (
    <div className="flex flex-col gap-3">
      <div className="border-border-default max-h-[24rem] overflow-auto border">
        <table className="w-full border-collapse text-[length:var(--type-ui-size-sm)]">
          <caption className="text-text-muted px-3 py-2 text-start">{caption}</caption>
          <thead className="bg-surface-base sticky top-0 z-10">
            <tr className="border-border-default border-b">
              {columns.map((column) => {
                const sortable = column.sortValue !== undefined;
                const active = sort !== null && sort.key === column.key;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    // `aria-sort` only where sorting is possible. On an
                    // unsortable column it would claim an affordance that is
                    // not there.
                    {...(sortable
                      ? { 'aria-sort': active ? sort.direction : ('none' as const) }
                      : {})}
                    className={`bg-surface-base px-3 py-2 font-medium ${
                      column.align === 'end' ? 'text-end' : 'text-start'
                    }`}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSort((current) => nextSort(current, column.key));
                        }}
                        className="hover:text-text-default focus-visible:outline-border-strong inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {column.header}
                        <span aria-hidden="true" className="text-text-muted">
                          {active ? (sort.direction === 'ascending' ? '↑' : '↓') : '↕'}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-border-default even:bg-surface-sunken/40 border-b"
              >
                {columns.map((column) => {
                  const content = column.render(row);
                  const alignment = column.align === 'end' ? 'text-end tabular-nums' : 'text-start';

                  return column.rowHeader === true ? (
                    <th
                      key={column.key}
                      scope="row"
                      className={`px-3 py-2 font-normal ${alignment}`}
                    >
                      {content}
                    </th>
                  ) : (
                    <td key={column.key} className={`px-3 py-2 ${alignment}`}>
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
       * `role="status"` is an assertive-free live region: it is announced when
       * it changes and never interrupts. Rendered always, empty when there is
       * nothing to say — a live region added to the DOM at the moment it gains
       * content is frequently not announced at all.
       */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
