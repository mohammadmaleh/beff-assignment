'use client';

import { useId, type ReactNode } from 'react';

import { Button } from '../Button/index';

import type { DataTableCopy, FilterState } from './types';

/**
 * The filter strip above a data table.
 *
 * ## Why the groups are captioned by their column
 *
 * The first version labelled the two range inputs `From` and `To` and stopped
 * there. On a page with five tables that is not a small imprecision - the same
 * two words meant per cent on the yield table, cells on throughput, euros on
 * scrap cost and Wh/kg on a control chart, and nothing on screen said which.
 * A filter that does not name what it filters is a defect, not a rough edge.
 *
 * Each group is now a `<fieldset>` captioned by the **column's own header**, so
 * a screen reader announces "First-pass yield, minimum, edit text" and a
 * sighted reader sees the column name above the pair.
 *
 * ## Why the range reads as one control
 *
 * Two bounds on one measure is a *window*, which is the single idea this whole
 * product is built on - a reading means nothing until you know the window it
 * sits in. Drawing the reader's filter the same way the product draws a
 * specification window is the one deliberate flourish here: a single hairline
 * enclosure, the two numerals set in the data face, joined by an en dash. The
 * rest of the strip stays quiet so that lands.
 */

/** A captioned cluster of related controls. */
function FilterGroup({
  legend,
  children,
  grow = false,
}: {
  legend: string;
  children: ReactNode;
  /** Takes the leftover width. Only the search field wants this. */
  grow?: boolean;
}) {
  return (
    <fieldset className={`m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0 ${grow ? 'flex-1' : ''}`}>
      <legend className="text-text-muted p-0 font-(family-name:--type-family-data) text-[length:var(--type-ui-size-xs)] tracking-[0.14em] uppercase">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * Two bounds in one enclosure.
 *
 * `focus-within` moves the border rather than adding a ring, so the enclosure
 * stays a single object when either half has focus - a ring on one input would
 * split the window back into two fields, which is the reading this is designed
 * to prevent.
 */
function BoundedRange({
  lowLabel,
  highLabel,
  low,
  high,
  onLow,
  onHigh,
  type,
  width,
  hint,
}: {
  lowLabel: string;
  highLabel: string;
  low: string;
  high: string;
  onLow: (value: string) => void;
  onHigh: (value: string) => void;
  type: 'number' | 'date';
  width: string;
  /** Shown when empty: the observed low and high of the data. */
  hint?: { low: string; high: string } | null;
}) {
  const id = useId();

  const input =
    'bg-transparent text-text-default px-3 py-2 text-[length:var(--type-ui-size-sm)] tabular-nums ' +
    'outline-none placeholder:text-text-muted';

  return (
    <div className="border-border-default rounded-chamfer bg-surface-base focus-within:border-text-default flex w-fit items-center border transition-[border-color] duration-(--motion-duration-fast)">
      <label htmlFor={`${id}-low`} className="sr-only">
        {lowLabel}
      </label>
      <input
        id={`${id}-low`}
        type={type}
        placeholder={hint?.low ?? ''}
        value={low}
        onChange={(event) => {
          onLow(event.target.value);
        }}
        className={`${input} ${width}`}
      />

      {/* The join. `aria-hidden` because the two labels already say which is which. */}
      <span aria-hidden="true" className="text-text-muted select-none">
        –
      </span>

      <label htmlFor={`${id}-high`} className="sr-only">
        {highLabel}
      </label>
      <input
        id={`${id}-high`}
        type={type}
        placeholder={hint?.high ?? ''}
        value={high}
        onChange={(event) => {
          onHigh(event.target.value);
        }}
        className={`${input} ${width}`}
      />
    </div>
  );
}

export function Toolbar({
  copy,
  filters,
  setFilter,
  onReset,
  onExport,
  filtering,
  /** Header of the column the range filter acts on, or `null` if there is none. */
  rangeColumn,
  rangeHint,
  /** Header of the column the date filter acts on, or `null` if there is none. */
  dateColumn,
  summary,
}: {
  copy: DataTableCopy;
  filters: FilterState;
  setFilter: (key: keyof FilterState) => (value: string) => void;
  onReset: () => void;
  onExport: () => void;
  filtering: boolean;
  rangeColumn: string | null;
  rangeHint: { low: string; high: string } | null;
  dateColumn: string | null;
  summary: ReactNode;
}) {
  const searchId = useId();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <FilterGroup legend={copy.search} grow>
          <label htmlFor={searchId} className="sr-only">
            {copy.search}
          </label>
          <input
            id={searchId}
            type="search"
            placeholder={copy.searchPlaceholder}
            value={filters.search}
            onChange={(event) => {
              setFilter('search')(event.target.value);
            }}
            className="border-border-default rounded-chamfer bg-surface-base text-text-default focus-within:border-text-default placeholder:text-text-muted focus:border-text-default w-full min-w-[14rem] border px-3 py-2 text-[length:var(--type-ui-size-sm)] transition-[border-color] duration-(--motion-duration-fast) outline-none"
          />
        </FilterGroup>

        {rangeColumn === null ? null : (
          <FilterGroup legend={rangeColumn}>
            <BoundedRange
              lowLabel={copy.rangeMin}
              highLabel={copy.rangeMax}
              low={filters.min}
              high={filters.max}
              onLow={setFilter('min')}
              onHigh={setFilter('max')}
              type="number"
              width="w-24"
              hint={rangeHint}
            />
          </FilterGroup>
        )}

        {dateColumn === null ? null : (
          <FilterGroup legend={dateColumn}>
            <BoundedRange
              lowLabel={copy.dateFrom}
              highLabel={copy.dateTo}
              low={filters.from}
              high={filters.to}
              onLow={setFilter('from')}
              onHigh={setFilter('to')}
              type="date"
              width="w-36"
            />
          </FilterGroup>
        )}
      </div>

      {/*
       * Count and actions on one rule, beneath the filters.
       *
       * The count sits with the actions rather than above the table because it
       * is the *result* of the controls above it, and because Download CSV
       * exports exactly the rows it names - putting them side by side is what
       * makes that relationship legible without a sentence explaining it.
       */}
      <div className="border-border-default flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        {summary}

        <div className="flex items-center gap-1">
          {filtering ? (
            <Button variant="ghost" onClick={onReset}>
              {copy.reset}
            </Button>
          ) : null}
          {/*
           * The brand plate, and the only one in the figure.
           *
           * An export nobody can see is an export nobody uses, and ghost was
           * exactly that. The accent lands here rather than on the view switch
           * because this is the one place in the figure it cannot be misread:
           * `brand-default` is a blue and so is `chart-series-1`, so a brand
           * fill beside the plot would sit above the bars it would be confused
           * with. A button in the toolbar is not adjacent to any mark.
           */}
          <Button variant="primary" onClick={onExport}>
            {copy.exportCsv}
          </Button>
        </div>
      </div>
    </div>
  );
}
