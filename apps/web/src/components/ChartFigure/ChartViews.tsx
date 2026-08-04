'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

type View = 'chart' | 'table';

/**
 * The Chart / Table switch, and the two panels it controls.
 *
 * Extracted from `ChartFigure` because two figures need it and they caption
 * themselves differently. The dashboard's charts want a real heading at the
 * caller's level; the landing page's `CostOfPosition` wants its uppercase
 * data-font label, which is a deliberate marketing treatment rather than an
 * inconsistency to be normalised away. Sharing the switch and not the caption
 * is what lets both be true — and it means the APG keyboard behaviour is
 * implemented once rather than copied and allowed to drift.
 *
 * Returns a fragment, not a wrapper. The caller supplies the layout, because
 * `<figcaption>` must be the first or last child of `<figure>` and a wrapper
 * `div` between them breaks the figure's accessible name.
 */
export function ChartViews({
  id,
  labelledBy,
  viewChartLabel,
  viewTableLabel,
  chart,
  table,
}: {
  /** Prefix for the tab and panel ids. Must be unique on the page. */
  id: string;
  /** Id of the element naming this figure — the tablist's accessible name. */
  labelledBy: string;
  viewChartLabel: string;
  viewTableLabel: string;
  chart: ReactNode;
  table: ReactNode;
}) {
  const [view, setView] = useState<View>('chart');
  const tabRefs = useRef<Record<View, HTMLButtonElement | null>>({ chart: null, table: null });

  const views: readonly { key: View; label: string }[] = [
    { key: 'chart', label: viewChartLabel },
    { key: 'table', label: viewTableLabel },
  ];

  /** Arrow keys move between tabs and select as they go, per the APG pattern. */
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
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
    <>
      <div
        role="tablist"
        // Named by the figure's own caption. Several of these can appear on one
        // page, and "Chart / Table" alone does not say which figure.
        aria-labelledby={labelledBy}
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
              onKeyDown={onKeyDown}
              onClick={() => {
                setView(key);
              }}
              className={`px-3 py-1.5 text-[length:var(--type-ui-size-sm)] ${
                selected
                  ? // Weight carries the selection, not just fill and text tone
                    // — colour alone is never the only signal, and
                    // `aria-selected` says nothing to a sighted low-vision
                    // reader looking straight at the tab strip.
                    'bg-surface-sunken text-text-default font-semibold'
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
          /*
           * The APG says a tabpanel with no focusable content takes
           * `tabIndex={0}`, so a keyboard user can scroll the panel they just
           * opened. Both panels qualify: the drawing is `aria-hidden` and the
           * table is static. The directive has to sit on the line immediately
           * before the attribute — a trailing `--` explanation makes the *next
           * line* the rest of the comment, and the rule then fires unsuppressed
           * one line further down while the directive reports itself unused.
           */
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="sm:col-span-2"
        >
          {key === 'chart' ? chart : table}
        </div>
      ))}
    </>
  );
}
