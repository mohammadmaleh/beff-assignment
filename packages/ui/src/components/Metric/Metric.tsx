import { cx } from '../../lib/cx/index';

export type MetricTrend = 'up' | 'down' | 'flat';

/**
 * The direction word spoken in place of the arrow glyph.
 *
 * Required whenever a trend is shown, and with no English default: the arrow is
 * `aria-hidden`, so this word is the only way the direction reaches a screen
 * reader at all.
 */
export type MetricTrendWords = Record<MetricTrend, string>;

/** A trend and its vocabulary travel together, or neither is present. */
type TrendProps =
  | { trend: MetricTrend; trendWords: MetricTrendWords }
  | { trend?: undefined; trendWords?: undefined };

export type MetricProps = TrendProps & {
  label: string;
  value: string;
  /** Rendered alongside the value at a smaller size — `%`, `Wh/kg`, `kg CO₂e/kWh`. */
  unit?: string;
  /** Signed, pre-formatted delta, e.g. `+1.4 pp`. */
  delta?: string;
  /**
   * Whether the trend is good news. Yield rising is good; scrap rising is not,
   * and the same arrow has to mean opposite things in the two tiles. Left
   * undefined, the delta stays neutral rather than guessing.
   */
  intent?: 'positive' | 'negative';
  className?: string;
};

const ARROWS: Record<MetricTrend, string> = { up: '▲', down: '▼', flat: '—' };

/**
 * A single figure with its label and movement.
 *
 * `tabular-nums` is not decoration: proportional digits shift the decimal point
 * between renders, and a column of yield percentages that jitters is a column
 * an engineer stops trusting.
 */
export function Metric({
  label,
  value,
  unit,
  delta,
  trend,
  trendWords,
  intent,
  className,
}: MetricProps) {
  const toneClass =
    intent === 'positive'
      ? 'text-status-success-fg'
      : intent === 'negative'
        ? 'text-status-danger-fg'
        : 'text-text-muted';

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <span className="text-text-muted text-[length:var(--type-ui-size-sm)]">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="font-(family-name:--type-family-data) text-[length:var(--type-ui-size-2xl)] tabular-nums">
          {value}
        </span>
        {unit ? (
          <span className="text-text-muted text-[length:var(--type-ui-size-sm)]">{unit}</span>
        ) : null}
      </span>
      {delta ? (
        <span
          className={cx('flex items-center gap-1 text-[length:var(--type-ui-size-sm)]', toneClass)}
        >
          {trend ? (
            <span aria-hidden="true" className="text-[0.7em]">
              {ARROWS[trend]}
            </span>
          ) : null}
          {/* The arrow is decorative; the word carries the direction for a
              screen reader, and for anyone who cannot separate the two hues. */}
          <span className="tabular-nums">
            {trend ? <span className="sr-only">{trendWords[trend]} </span> : null}
            {delta}
          </span>
        </span>
      ) : null}
    </div>
  );
}
