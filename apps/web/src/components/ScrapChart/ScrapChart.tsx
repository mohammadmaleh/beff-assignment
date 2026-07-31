import { getDictionary, type Locale } from '@/lib/i18n';

export interface ScrapRow {
  process_step: string;
  scrap_rate_pct: number;
  committed_value_eur: number;
}

/**
 * ## Scrap by process step
 *
 * ### Why the table is the real thing
 *
 * The bars are `aria-hidden`. The `<table>` below them is not an "alternative"
 * bolted on for compliance — it is the authoritative rendering, and the chart
 * is a fast visual index into it. That inversion is deliberate: a chart built
 * accessible-first cannot drift out of sync with its own description, because
 * there is only one source of numbers.
 *
 * `<details>` rather than a state toggle: it is a native disclosure widget, so
 * it is keyboard operable, announced as expanded or collapsed, and works before
 * hydration. This whole component is a server component for that reason.
 *
 * ### Why there is no colour scale
 *
 * Every bar is one neutral. Colouring by severity would mean encoding a
 * quantity in hue, which fails for roughly one man in twelve, and `success` /
 * `warning` / `danger` are reserved for *in spec* versus *out of spec* — using
 * them for "more scrap" would make the palette mean two different things in one
 * screen. Magnitude is carried by bar length and by the number printed at the
 * end of every bar, which is legible in greyscale and to a screen reader.
 *
 * ### Ordering
 *
 * Process order, never sorted by size. A cell lost at formation has absorbed
 * every upstream cost, so the position of a bar carries economic meaning that
 * re-sorting would destroy.
 */
export function ScrapChart({
  rows,
  locale,
  order,
}: {
  rows: readonly ScrapRow[];
  locale: Locale;
  /** Canonical process order, from CONTEXT.md. */
  order: readonly string[];
}) {
  const t = getDictionary(locale);
  const steps = t.dashboard.steps as Record<string, string>;

  const ordered = [...rows].sort(
    (a, b) => order.indexOf(a.process_step) - order.indexOf(b.process_step),
  );
  const worst = Math.max(...ordered.map((row) => row.scrap_rate_pct), 1);

  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

  return (
    <div className="flex flex-col gap-6">
      <ul aria-hidden="true" className="flex flex-col gap-2">
        {ordered.map((row) => (
          <li key={row.process_step} className="grid grid-cols-[10rem_1fr_4rem] items-center gap-3">
            <span className="text-text-muted truncate text-[length:var(--type-ui-size-sm)]">
              {steps[row.process_step] ?? row.process_step}
            </span>
            <span className="bg-surface-sunken block h-4">
              <span
                className="bg-band-range block h-4"
                style={{ inlineSize: `${String((row.scrap_rate_pct / worst) * 100)}%` }}
              />
            </span>
            <span className="text-end text-[length:var(--type-ui-size-sm)] tabular-nums">
              {number.format(row.scrap_rate_pct)}%
            </span>
          </li>
        ))}
      </ul>

      <details className="border-border-default border-t pt-4">
        <summary className="cursor-pointer text-[length:var(--type-ui-size-sm)]">
          {t.dashboard.showTable}
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--type-ui-size-sm)]">
            <caption className="text-text-muted pb-3 text-start">
              {t.dashboard.scrapTableCaption}
            </caption>
            <thead>
              <tr className="border-border-default border-b">
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {t.dashboard.columnStep}
                </th>
                <th scope="col" className="py-2 pe-4 text-end font-medium">
                  {t.dashboard.columnScrap}
                </th>
                <th scope="col" className="py-2 text-end font-medium">
                  {t.dashboard.columnCost}
                </th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => (
                <tr key={row.process_step} className="border-border-default border-b">
                  <th scope="row" className="py-2 pe-4 text-start font-normal">
                    {steps[row.process_step] ?? row.process_step}
                  </th>
                  <td className="py-2 pe-4 text-end tabular-nums">
                    {number.format(row.scrap_rate_pct)}%
                  </td>
                  <td className="py-2 text-end tabular-nums">
                    {money.format(row.committed_value_eur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
