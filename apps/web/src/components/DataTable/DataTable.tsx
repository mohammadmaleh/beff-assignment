'use client';

import { useMemo, useState } from 'react';

import { Button } from '@beff/ui/button';
import { TextField } from '@beff/ui/text-field';

import { csvDelimiter, downloadCsv, toCsv } from './csv';
import { applyFilters, EMPTY_FILTERS, hasActiveFilter, sortRows } from './model';

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

  const hasRange = columns.some((column) => column.filterRange !== undefined);
  const hasDate = columns.some((column) => column.filterDate !== undefined);
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <TextField
            label={copy.search}
            type="search"
            placeholder={copy.searchPlaceholder}
            value={filters.search}
            onChange={(event) => {
              set('search')(event.target.value);
            }}
          />
        </div>

        {hasRange ? (
          <>
            <div className="w-28">
              <TextField
                label={copy.rangeMin}
                type="number"
                value={filters.min}
                onChange={(event) => {
                  set('min')(event.target.value);
                }}
              />
            </div>
            <div className="w-28">
              <TextField
                label={copy.rangeMax}
                type="number"
                value={filters.max}
                onChange={(event) => {
                  set('max')(event.target.value);
                }}
              />
            </div>
          </>
        ) : null}

        {hasDate ? (
          <>
            <div className="w-40">
              <TextField
                label={copy.dateFrom}
                type="date"
                value={filters.from}
                onChange={(event) => {
                  set('from')(event.target.value);
                }}
              />
            </div>
            <div className="w-40">
              <TextField
                label={copy.dateTo}
                type="date"
                value={filters.to}
                onChange={(event) => {
                  set('to')(event.target.value);
                }}
              />
            </div>
          </>
        ) : null}

        {filtering ? (
          <Button
            variant="ghost"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
            }}
          >
            {copy.reset}
          </Button>
        ) : null}

        <Button
          variant="secondary"
          onClick={() => {
            const stamp = new Date().toISOString().slice(0, 10);
            // `visible`, not `rows`: the export is what the reader is looking
            // at, filters and sort included. An export that quietly differs
            // from the screen is worse than none.
            downloadCsv(
              toCsv(columns, visible, csvDelimiter(locale)),
              `beff-${csvName}-${stamp}.csv`,
            );
          }}
        >
          {copy.exportCsv}
        </Button>
      </div>

      <p
        role="status"
        aria-live="polite"
        className="text-text-muted text-[length:var(--type-ui-size-sm)]"
      >
        {announcement === '' ? summary : `${summary}. ${announcement}`}
      </p>

      {visible.length === 0 ? (
        <p className="text-text-muted px-3 py-6 text-[length:var(--type-ui-size-sm)]">
          {copy.empty}
        </p>
      ) : (
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
                            setLastSortedKey(column.key);
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
                    const badge = column.badge?.(row);
                    /*
                     * A badge replaces the cell rather than decorating it, and
                     * carries its label as a word inside the pill — the same
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
      )}
    </div>
  );
}
