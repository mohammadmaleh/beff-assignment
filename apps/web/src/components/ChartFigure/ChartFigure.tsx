'use client';

import { useRef, useState, type ReactNode } from 'react';

type View = 'chart' | 'table';

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
  const [view, setView] = useState<View>('chart');
  const tabRefs = useRef<Record<View, HTMLButtonElement | null>>({ chart: null, table: null });

  const views: readonly { key: View; label: string }[] = [
    { key: 'chart', label: viewChartLabel },
    { key: 'table', label: viewTableLabel },
  ];

  /** Arrow keys move between tabs and select as they go, per the APG pattern. */
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const order: View[] = ['chart', 'table'];
    const index = order.indexOf(view);
    const next =
      event.key === 'ArrowRight'
        ? order[(index + 1) % order.length]
        : event.key === 'ArrowLeft'
          ? order[(index - 1 + order.length) % order.length]
          : event.key === 'Home'
            ? order[0]
            : event.key === 'End'
              ? order[order.length - 1]
              : undefined;

    if (next === undefined) return;

    event.preventDefault();
    setView(next);
    tabRefs.current[next]?.focus();
  }

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

      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- the
           APG roving-tabindex pattern puts focus on the tabs themselves, never
           on the tablist container; the plugin has no exception for that. */}
      <div
        role="tablist"
        // Named by the chart's own heading. Five figures on a page each carry
        // one of these, and "Chart / Table" alone does not say which chart.
        aria-labelledby={id}
        onKeyDown={onKeyDown}
        className="border-border-default rounded-chamfer flex border sm:justify-self-end"
      >
        {views.map(({ key, label }) => {
          const selected = view === key;
          return (
            <button
              key={key}
              ref={(node) => {
                tabRefs.current[key] = node;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${key}`}
              aria-selected={selected}
              aria-controls={`${id}-panel-${key}`}
              // Roving tabindex: one stop for the whole tablist, arrows inside.
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                setView(key);
              }}
              className={`px-3 py-1.5 text-[length:var(--type-ui-size-sm)] ${
                selected
                  ? 'bg-surface-sunken text-text-default'
                  : 'text-text-muted hover:text-text-default'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {views.map(({ key }) => (
        <div
          key={key}
          role="tabpanel"
          id={`${id}-panel-${key}`}
          aria-labelledby={`${id}-tab-${key}`}
          hidden={view !== key}
          // Focusable so a keyboard user can scroll the panel they just
          // opened, per the APG tabpanel pattern — the plugin's role list
          // treats "tabpanel" as non-interactive and has no exception for it.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="sm:col-span-2"
        >
          {key === 'chart' ? chart : table}
        </div>
      ))}
    </figure>
  );
}
