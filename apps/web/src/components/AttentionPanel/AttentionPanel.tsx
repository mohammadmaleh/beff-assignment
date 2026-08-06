'use client';

import { useMemo } from 'react';

import { PERCENT } from '@/constants/units';
import { formatters } from '@/lib/format';
import { getDictionary, translate, type Locale } from '@/lib/i18n';
import { yieldWindow } from '@/lib/metrics';

import type { Formatters } from '@/lib/format';
import type { MetricsOverview, MetricsTrend } from '@/lib/metrics';

/**
 * What the finding is, independent of how it is worded.
 *
 * Kept as data rather than as pre-rendered sentences so the rule ("porosity is
 * outside its window") can be unit-tested without a dictionary, and so German
 * is a rendering concern rather than a second implementation of the rule.
 */
export type Finding =
  | {
      kind: 'parameter';
      parameter: string;
      value: number;
      unit: string;
      lower: number;
      upper: number;
    }
  | { kind: 'yield'; value: number; lower: number; upper: number }
  | { kind: 'cohort'; gapPp: number }
  | { kind: 'cost'; step: string; eur: number }
  | { kind: 'clear' };

/** Danger, warning, or a plain statement. Never the only signal — see below. */
export type FindingTone = 'danger' | 'warning' | 'neutral';

export const findingTone = (finding: Finding): FindingTone => {
  switch (finding.kind) {
    case 'parameter':
    case 'yield':
      return 'danger';
    case 'cohort':
      return 'warning';
    default:
      return 'neutral';
  }
};

/**
 * Everything on this page that is currently wrong, in the order it matters.
 *
 * ## Why this exists
 *
 * The readings, the process parameters and the scrap breakdown each answer a
 * question, and each answers it in its own section — so "is anything wrong
 * right now" costs the reader a scan of the whole page every morning. That is
 * exactly the work software should be doing.
 *
 * ## Order, and why `clear` is a finding
 *
 * Out-of-spec first, because a reading outside its window is the only thing
 * here that stops a line. The cohort gap second: below the median of comparable
 * lines is not a fault, it is an opportunity, and conflating the two trains
 * people to ignore both. The most expensive process step always appears, in
 * spec or not, because the money does not stop being the money on a good day.
 *
 * An empty list is indistinguishable from a panel that failed to load, so
 * "everything is inside its window" is stated rather than implied.
 */
export function findings(overview: MetricsOverview, trend: MetricsTrend | undefined): Finding[] {
  const found: Finding[] = [];

  const spec = yieldWindow(overview.line_kind);
  if (
    overview.first_pass_yield_pct < spec.lowerLimit ||
    overview.first_pass_yield_pct > spec.upperLimit
  ) {
    found.push({
      kind: 'yield',
      value: overview.first_pass_yield_pct,
      lower: spec.lowerLimit,
      upper: spec.upperLimit,
    });
  }

  for (const band of overview.spec_bands) {
    if (band.value >= band.lower_limit && band.value <= band.upper_limit) continue;
    found.push({
      kind: 'parameter',
      parameter: band.parameter,
      value: band.value,
      unit: band.unit,
      lower: band.lower_limit,
      upper: band.upper_limit,
    });
  }

  if (trend !== undefined) {
    const gap = trend.window_first_pass_yield_pct - trend.benchmark.first_pass_yield_p50_pct;
    if (gap < 0) found.push({ kind: 'cohort', gapPp: gap });
  }

  // `reduce` rather than a sort, so the input array is never mutated and the
  // scrap breakdown below keeps the process order its meaning depends on.
  const costliest = overview.scrap_by_step.reduce<MetricsOverview['scrap_by_step'][number] | null>(
    (worst, row) =>
      worst === null || row.committed_value_eur > worst.committed_value_eur ? row : worst,
    null,
  );
  if (costliest !== null) {
    found.push({ kind: 'cost', step: costliest.process_step, eur: costliest.committed_value_eur });
  }

  /*
   * `some(… !== 'cost')` rather than `every(… === 'cost')`, which reads better
   * and does not compile: TypeScript narrows the array through `every`'s type
   * predicate, so `found` becomes an array of `cost` findings and pushing
   * `clear` onto it is an error about a line that is correct.
   */
  if (!found.some((finding) => finding.kind !== 'cost')) found.unshift({ kind: 'clear' });

  return found;
}

/**
 * A reading and its unit, without concatenating a percent sign.
 *
 * German puts a **non-breaking** space before `%` and `Intl` already knows
 * that; a template literal does not, and `' %'` lets the sign wrap alone onto
 * the next line. Units the formatter has no notion of — `Wh/kg`, `mg/cm²` —
 * take an ordinary space, which is correct for them in both locales.
 */
export function reading(value: number, unit: string, format: Formatters): string {
  return unit === PERCENT ? format.percent(value) : `${format.decimal(value)} ${unit}`;
}

const TONE_CLASS: Record<FindingTone, string> = {
  danger: 'text-status-danger-fg',
  warning: 'text-status-warning-fg',
  neutral: 'text-text-muted',
};

/**
 * The exceptions, at the top of the page.
 *
 * Colour is never the only signal: every row carries a **word** — out of spec,
 * below peers, largest loss — and the word is what a screen reader announces
 * and what survives greyscale. The hue is a second encoding of something
 * already said.
 */
export function AttentionPanel({
  overview,
  trend,
  locale,
}: {
  overview: MetricsOverview;
  /**
   * Required, and explicitly nullable rather than optional.
   *
   * `exactOptionalPropertyTypes` is on, so `trend?: MetricsTrend` would reject
   * the only call site there is — React Query's `data`, which is `undefined`
   * until the second request lands. Optional would also let a caller forget it
   * silently, and the cohort finding would then never appear.
   */
  trend: MetricsTrend | undefined;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const copy = t.dashboard.attention;
  const format = useMemo(() => formatters(locale), [locale]);

  const items = useMemo(() => findings(overview, trend), [overview, trend]);

  const describe = (finding: Finding): { label: string; body: string } => {
    switch (finding.kind) {
      case 'yield':
        return {
          label: copy.outOfSpec,
          body: copy.yieldBody
            .replace('{value}', format.percent(finding.value))
            .replace('{lower}', format.percent(finding.lower))
            .replace('{upper}', format.percent(finding.upper)),
        };
      case 'parameter':
        return {
          label: copy.outOfSpec,
          body: copy.parameterBody
            .replace('{parameter}', translate(t.dashboard.parameters, finding.parameter))
            .replace('{value}', reading(finding.value, finding.unit, format))
            .replace('{lower}', reading(finding.lower, finding.unit, format))
            .replace('{upper}', reading(finding.upper, finding.unit, format)),
        };
      case 'cohort':
        return {
          label: copy.belowPeers,
          // `Math.abs` — the sentence already says "below", and "-3.7 pp below"
          // says it twice with opposite signs.
          body: copy.cohortBody.replace('{gap}', format.percentagePoints(Math.abs(finding.gapPp))),
        };
      case 'cost':
        return {
          label: copy.largestLoss,
          body: copy.costBody
            .replace('{step}', translate(t.dashboard.steps, finding.step))
            .replace('{value}', format.euro(finding.eur)),
        };
      default:
        return { label: copy.inSpec, body: copy.clearBody };
    }
  };

  return (
    <section aria-labelledby="attention" className="flex flex-col gap-3">
      <h2
        id="attention"
        className="text-text-muted text-[length:var(--type-ui-size-sm)] font-medium"
      >
        {copy.title}
      </h2>

      <ul className="flex flex-col gap-2">
        {items.map((finding, index) => {
          const { label, body } = describe(finding);
          return (
            <li
              // The kind alone is not unique — a line can have three parameters
              // out of spec at once, and React would then reuse one row's DOM
              // for another's content.
              key={`${finding.kind}-${String(index)}`}
              className="border-border-default flex flex-col gap-0.5 border-s-2 ps-3"
            >
              <span
                className={`text-[length:var(--type-ui-size-xs)] font-medium tracking-[0.08em] uppercase ${TONE_CLASS[findingTone(finding)]}`}
              >
                {label}
              </span>
              <span className="text-text-default text-[length:var(--type-ui-size-sm)] tabular-nums">
                {body}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
