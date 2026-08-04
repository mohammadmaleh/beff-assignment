import type { Locale } from '@/lib/i18n';

/**
 * Locale-aware formatters for everything a chart prints.
 *
 * ## Why nothing here concatenates a unit
 *
 * German writes `90 %` with a **non-breaking** space before the sign, and
 * `Intl.NumberFormat` already knows that. A template literal does not:
 * `` `${n}%` `` renders `90%` in German, and `` `${n} %` `` uses an ordinary
 * space, which lets the sign wrap alone onto the next line. Both are wrong in a
 * locale this product ships.
 *
 * So percentages go through `style: 'percent'` and are divided by 100 on the
 * way in — the API's convention is 0–100 (`_pct`), and `Intl`'s is 0–1. That
 * conversion is the entire reason this module exists rather than each chart
 * calling `Intl` itself: it is exactly the sort of thing that gets done
 * correctly in four places and forgotten in the fifth.
 */

export interface ChartFormatters {
  /** A percentage from a 0–100 value, with the locale's own sign and spacing. */
  percent: (value: number) => string;
  /** Euros, no cents — a scrap cost of `4 213,67 €` implies a precision nobody has. */
  euro: (value: number) => string;
  /** Cell counts. Grouped, so `1 240` is legible at a glance. */
  count: (value: number) => string;
  /** A bare decimal, for units the formatter has no notion of (Wh/kg, mg/cm²). */
  decimal: (value: number, fractionDigits?: number) => string;
  /** A short date for an axis tick — day and month, never the year. */
  axisDate: (value: string) => string;
  /** A full date for a tooltip, where there is room to be unambiguous. */
  fullDate: (value: string) => string;
}

export function chartFormatters(locale: Locale): ChartFormatters {
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const euro = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
  const count = new Intl.NumberFormat(locale);
  const axisDate = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return {
    percent: (value) => percent.format(value / 100),
    euro: (value) => euro.format(value),
    count: (value) => count.format(value),
    decimal: (value, fractionDigits = 1) =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value),
    axisDate: (value) => axisDate.format(new Date(value)),
    fullDate: (value) => fullDate.format(new Date(value)),
  };
}
