import type { ReactNode } from 'react';

/**
 * The frame every chart in this app is mounted in.
 *
 * ## What it guarantees
 *
 * A `<figure>` with a real `<figcaption>`, a drawing that is `aria-hidden`, and
 * a `<table>` behind a native `<details>` that carries the same numbers. The
 * table is not an alternative bolted on for compliance — it is the
 * authoritative rendering, and the drawing is a fast visual index into it.
 * `ScrapChart` set that inversion and this generalises it, so a fifth chart
 * cannot be added without one.
 *
 * `<details>` rather than a state toggle, for the same reasons as there: it is
 * a native disclosure widget, so it is keyboard operable, announced as expanded
 * or collapsed, and works before hydration.
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
  showTableLabel,
  tableCaption,
  chart,
  table,
  headingLevel = 'h3',
  id,
}: {
  title: string;
  /** What the chart shows and how to read it. Always rendered, never a tooltip. */
  description: string;
  /** The `<summary>` text — "Show the data as a table". */
  showTableLabel: string;
  /** The `<caption>` inside the table, which is its own accessible name. */
  tableCaption: string;
  chart: ReactNode;
  /** The `<tbody>`-and-`<thead>` content. `ChartFigure` supplies the `<table>`. */
  table: ReactNode;
  headingLevel?: 'h2' | 'h3';
  id: string;
}) {
  const Heading = headingLevel;

  return (
    <figure className="m-0 flex flex-col gap-3">
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

      {chart}

      <details className="border-border-default border-t pt-3">
        <summary className="text-text-muted hover:text-text-default cursor-pointer text-[length:var(--type-ui-size-sm)]">
          {showTableLabel}
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--type-ui-size-sm)]">
            <caption className="text-text-muted pb-3 text-start">{tableCaption}</caption>
            {table}
          </table>
        </div>
      </details>
    </figure>
  );
}
