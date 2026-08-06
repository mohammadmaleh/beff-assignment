import { PERCENTAGE_POINTS } from '@/constants/units';

import type { Locale } from '@/lib/i18n';

/**
 * Every number this app prints, formatted once.
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
 * way in - the API's convention is 0–100 (`_pct`), and `Intl`'s is 0–1. That
 * conversion is the entire reason this module exists rather than each caller
 * calling `Intl` itself: it is exactly the sort of thing that gets done
 * correctly in four places and forgotten in the fifth.
 *
 * ## Why this is no longer `chartFormatters`
 *
 * It was named for the four charts that first needed it, and meanwhile the
 * dashboard, the KPI row, the marketing product panel and the cost figure each
 * built their *own* `Intl.NumberFormat` for a signed percentage point or a
 * one-decimal number - six constructions of four formatters, which is six
 * chances for the marketing page to round a figure differently from the
 * dashboard rendering the same one. They all read from here now, and the
 * charts' own `format.axisDate` sits beside them because a chart axis and a
 * table cell showing the same date must agree.
 */
export interface Formatters {
  /** A percentage from a 0–100 value, with the locale's own sign and spacing. */
  percent: (value: number) => string;
  /**
   * The same, to whole numbers.
   *
   * The committed-value curve is a set of round figures by construction - 4%,
   * 45%, 100% - and a trailing `,0` on every one of them claims a precision the
   * model does not have.
   */
  percentWhole: (value: number) => string;
  /** Euros, no cents - a scrap cost of `4 213,67 €` implies a precision nobody has. */
  euro: (value: number) => string;
  /** Cell counts. Grouped, so `1 240` is legible at a glance. */
  count: (value: number) => string;
  /** A bare decimal, for units the formatter has no notion of (Wh/kg, mg/cm²). */
  decimal: (value: number, fractionDigits?: number) => string;
  /**
   * A movement in percentage points, signed and suffixed - `+1,4 pp`.
   *
   * Percentage points, never a percentage change, and the difference is not
   * pedantry: "up 5%" from 68% is ambiguous between 71.4 and 73, and on a yield
   * figure those are different weeks. `signDisplay: 'exceptZero'` so a flat
   * period reads `0,0 pp` rather than claiming a rise of nothing.
   */
  percentagePoints: (value: number) => string;
  /** A short date for an axis tick - day and month, never the year. */
  axisDate: (value: string) => string;
  /** A full date for a tooltip, where there is room to be unambiguous. */
  fullDate: (value: string) => string;
}

export function formatters(locale: Locale): Formatters {
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const percentWhole = new Intl.NumberFormat(locale, { style: 'percent' });
  const euro = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
  const count = new Intl.NumberFormat(locale);
  const signed = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  });
  const axisDate = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return {
    percent: (value) => percent.format(value / 100),
    percentWhole: (value) => percentWhole.format(value / 100),
    euro: (value) => euro.format(value),
    count: (value) => count.format(value),
    decimal: (value, fractionDigits = 1) =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value),
    percentagePoints: (value) => `${signed.format(value)} ${PERCENTAGE_POINTS}`,
    axisDate: (value) => axisDate.format(new Date(value)),
    fullDate: (value) => fullDate.format(new Date(value)),
  };
}
