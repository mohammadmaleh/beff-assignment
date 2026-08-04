'use client';

import type { ReactNode } from 'react';

import { ChartViews } from './ChartViews';

/**
 * The frame every chart in this app is mounted in.
 *
 * ## What it guarantees
 *
 * A `<figure>` with a real `<figcaption>`, a drawing that is `aria-hidden`, and
 * a `<table>` that carries the same numbers as a peer view — not a footnote
 * disclosed underneath. The table is not an alternative bolted on for
 * compliance — it is the authoritative rendering, and the drawing is a fast
 * visual index into it. `ScrapChart` set that inversion and this generalises
 * it, so a fifth chart cannot be added without one.
 *
 * ## Why a tablist, not `<details>`
 *
 * `<details>` was defensible while the table was an alternative disclosed on
 * demand. It stops being defensible once the table is the authoritative
 * rendering: a grey line of text below a hairline rule said "extra" to
 * everyone who could see it, while the docstring said the opposite. The
 * pre-hydration argument for `<details>` is also void on this surface — the
 * dashboard is client-rendered off React Query, so before JS runs there are no
 * rows to disclose either way. A tablist names both views equally and states
 * which one is showing.
 *
 * ## Why `title` and `description` are required strings
 *
 * The chart's drawing is hidden from assistive technology, so this caption is
 * the chart's *entire* announced identity above the table. A component that
 * defaulted either one would ship an English caption onto the German dashboard,
 * and nothing would catch it: axe is indifferent to which language a
 * well-formed string is in, and so is every screenshot. Same rule, same reason,
 * as `SpecBand`'s readout.
 */
export function ChartFigure({
  title,
  description,
  viewChartLabel,
  viewTableLabel,
  chart,
  table,
  headingLevel = 'h3',
  id,
}: {
  title: string;
  /** What the chart shows and how to read it. Always rendered, never a tooltip. */
  description: string;
  /** The Chart tab's label. */
  viewChartLabel: string;
  /** The Table tab's label. */
  viewTableLabel: string;
  chart: ReactNode;
  /** A complete `<table>`, normally a `DataTable`. */
  table: ReactNode;
  headingLevel?: 'h2' | 'h3';
  id: string;
}) {
  const Heading = headingLevel;

  return (
    /*
     * A grid rather than a flex header row, because `<figcaption>` must be the
     * first or last child of `<figure>`. Wrapping it with the tablist in a
     * header `div` is invalid HTML and breaks the figure's accessible name —
     * the tablist is a sibling, placed beside the caption by the grid.
     */
    <figure className="m-0 grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_auto]">
      <figcaption className="flex flex-col gap-1">
        <Heading
          id={id}
          className="text-text-default text-[length:var(--type-ui-size-md)] font-medium"
        >
          {title}
        </Heading>
        <p className="text-text-muted max-w-[var(--type-prose-measure)] text-[length:var(--type-ui-size-sm)]">
          {description}
        </p>
      </figcaption>

      <ChartViews
        id={id}
        labelledBy={id}
        viewChartLabel={viewChartLabel}
        viewTableLabel={viewTableLabel}
        chart={chart}
        table={table}
      />
    </figure>
  );
}
