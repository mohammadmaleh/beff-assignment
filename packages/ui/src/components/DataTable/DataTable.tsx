'use client';

import { useMemo, useState } from 'react';

import { csvDelimiter, downloadCsv, toCsv } from './csv';
import { Toolbar } from './Toolbar';
import { applyFilters, EMPTY_FILTERS, hasActiveFilter, sortRows } from './model';

import type { DataColumn, DataTableCopy, SortState } from './types';

export interface DataTableProps<Row> {
  /** The `<caption>`, which is the table's accessible name. */
  caption: string;
  columns: readonly DataColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /**
   * A BCP 47 tag, used only for the CSV delimiter - cell values arrive already
   * formatted. Deliberately a plain string rather than the app's `Locale` union:
   * a table that only accepts the two locales this product ships is a table the
   * design system cannot lend to anything else.
   */
  locale: string;
  /**
   * Filename stem, e.g. `beff-first-pass-yield`. The download appends the day.
   *
   * The whole stem, brand included, comes from the caller. It used to be
   * assembled here as `` `beff-${csvName}` ``, which put a customer's name
   * inside a component that has no business knowing one.
   */
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
 * It takes column *descriptors* rather than markup. That is the whole point -
 * six charts previously handed `ChartFigure` six hand-rolled `<tbody>` blobs,
 * and markup cannot be sorted, so nothing shared could exist even in principle.
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  locale,
  csvName,
  copy,
}: DataTableProps<Row>) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState | null>(null);
  const [lastSortedKey, setLastSortedKey] = useState<string | null>(null);

  /*
   * The *header* of the filtering column, not merely whether one exists.
   *
   * This is what the toolbar captions each group with. `From` and `To` alone
   * meant per cent here, cells on the throughput table, euros on scrap cost and
   * Wh/kg on a control chart - four different measures wearing the same two
   * words, with nothing on screen to tell them apart.
   */
  const rangeColumn = columns.find((column) => column.filterRange !== undefined)?.header ?? null;
  const dateColumn = columns.find((column) => column.filterDate !== undefined)?.header ?? null;

  /*
   * The observed low and high of the range column, formatted by that column.
   *
   * These are the range inputs' placeholders, and they earn their place twice
   * over: an empty bounded control is otherwise just a box with a dash in it
   * and no hint that it holds two fields, and "what range is even available?"
   * is the question a reader has *before* they can pick a bound. Rendered
   * through the column's own `text`, so the hint is formatted exactly like the
   * values in the column it filters - per cent here, euros on scrap cost.
   */
  const rangeHint = useMemo(() => {
    const column = columns.find((entry) => entry.filterRange !== undefined);
    const read = column?.filterRange;
    if (column === undefined || read === undefined || rows.length === 0) return null;

    let low = rows[0] as Row;
    let high = rows[0] as Row;
    for (const row of rows) {
      if (read(row) < read(low)) low = row;
      if (read(row) > read(high)) high = row;
    }
    return { low: column.text(low), high: column.text(high) };
  }, [columns, rows]);
  const filtering = hasActiveFilter(filters);

  // Filter first, then sort. The other order sorts rows that are about to be
  // discarded, which on sixty rows is invisible and on six hundred is not.
  const visible = useMemo(
    () => sortRows(applyFilters(rows, columns, filters), columns, sort),
    [rows, columns, filters, sort],
  );

  const summary = copy.summary
    .replace('{shown}', String(visible.length))
    .replace('{total}', String(rows.length));

  const set = (key: keyof typeof filters) => (value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  /*
   * Sorting reorders rows silently. A screen reader user gets no signal at all
   * unless one is spoken, so the state is mirrored here as a sentence.
   */
  const announcement = useMemo(() => {
    if (sort === null && lastSortedKey !== null) {
      const header = columns.find((column) => column.key === lastSortedKey)?.header ?? '';
      return copy.sortCleared.replace('{column}', header);
    }
    if (sort === null) return '';
    const header = columns.find((column) => column.key === sort.key)?.header ?? '';
    const template = sort.direction === 'ascending' ? copy.sortedAscending : copy.sortedDescending;
    return template.replace('{column}', header);
  }, [sort, lastSortedKey, columns, copy]);

  return (
    <div className="flex flex-col gap-3">
      <Toolbar
        copy={copy}
        filters={filters}
        setFilter={set}
        onReset={() => {
          setFilters(EMPTY_FILTERS);
        }}
        onExport={() => {
          const stamp = new Date().toISOString().slice(0, 10);
          // `visible`, not `rows`: the export is what the reader is looking at,
          // filters and sort included. An export that quietly differs from the
          // screen is worse than none.
          downloadCsv(toCsv(columns, visible, csvDelimiter(locale)), `${csvName}-${stamp}.csv`);
        }}
        filtering={filtering}
        rangeColumn={rangeColumn}
        rangeHint={rangeHint}
        dateColumn={dateColumn}
        summary={
          <p
            role="status"
            aria-live="polite"
            className="text-text-muted font-(family-name:--type-family-data) text-[length:var(--type-ui-size-xs)] tracking-[0.14em] uppercase tabular-nums"
          >
            {announcement === '' ? summary : `${summary}. ${announcement}`}
          </p>
        }
      />

      {visible.length === 0 ? (
        <p className="text-text-muted px-3 py-6 text-[length:var(--type-ui-size-sm)]">
          {copy.empty}
        </p>
      ) : (
        <div className="border-border-default max-h-[24rem] overflow-auto border">
          <table className="w-full border-collapse text-[length:var(--type-ui-size-sm)]">
            <caption className="text-text-muted px-3 pt-3 text-start text-[length:var(--type-ui-size-sm)]">
              {caption}
            </caption>
            <thead className="bg-surface-base sticky top-0 z-10">
              <tr className="border-border-strong border-b">
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
                      className={`bg-surface-base text-text-muted px-3 pt-3 pb-2 font-(family-name:--type-family-data) text-[length:var(--type-ui-size-xs)] font-normal tracking-[0.14em] whitespace-nowrap uppercase ${
                        column.align === 'end' ? 'text-end' : 'text-start'
                      }`}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => {
                            setLastSortedKey(column.key);
                            setSort((current) => nextSort(current, column.key));
                          }}
                          className={`group focus-visible:outline-border-strong inline-flex items-center gap-1.5 tracking-[0.14em] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 ${
                            active ? 'text-text-default' : 'hover:text-text-default'
                          }`}
                        >
                          {column.header}
                          {/*
                           * The direction when sorted; a hint only on hover or
                           * keyboard focus otherwise. A permanent glyph on every
                           * sortable column is four arrows of noise on a
                           * four-column table, and it says nothing - every
                           * column is sortable, so marking them all marks none.
                           */}
                          <span
                            aria-hidden="true"
                            className={
                              active
                                ? 'text-text-default'
                                : 'text-text-muted opacity-0 transition-opacity duration-(--motion-duration-fast) group-hover:opacity-100 group-focus-visible:opacity-100'
                            }
                          >
                            {active && sort.direction === 'descending' ? '↓' : '↑'}
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
                  className="border-border-default even:bg-surface-sunken/30 border-b last:border-b-0"
                >
                  {columns.map((column) => {
                    const badge = column.badge?.(row);
                    /*
                     * A badge replaces the cell rather than decorating it, and
                     * carries its label as a word inside the pill - the same
                     * rule the drawing's red marker follows, where colour is the
                     * second encoding and never the only one.
                     *
                     * Bordered rather than filled, reusing `Alert`'s
                     * `border-status-danger-fg` / `text-status-danger-fg` pair.
                     * There is no `status-danger-bg` token: a filled pill would
                     * mean inventing a colour pair the contrast gate has never
                     * solved, which is how a palette nobody chose gets blessed.
                     */
                    const content =
                      badge === undefined ? (
                        column.render(row)
                      ) : (
                        <span
                          className={`rounded-chamfer inline-block border px-2 py-0.5 ${
                            badge.intent === 'danger'
                              ? 'border-status-danger-fg text-status-danger-fg'
                              : 'border-border-default text-text-muted'
                          }`}
                        >
                          {badge.label}
                        </span>
                      );
                    const alignment =
                      column.align === 'end' ? 'text-end tabular-nums' : 'text-start';

                    return column.rowHeader === true ? (
                      <th
                        key={column.key}
                        scope="row"
                        // A batch code is one token; wrapped over two lines it
                        // reads as two, and the row grows to match.
                        className={`px-3 py-2 font-normal whitespace-nowrap ${alignment}`}
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
      )}
    </div>
  );
}
