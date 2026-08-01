import { cx } from '../../lib/cx/index';

/**
 * The words the text readout is built from.
 *
 * Required, with no English default. The readout is the *only* form of this
 * component a screen reader can perceive — the bar itself is `aria-hidden` —
 * so a default in the wrong language is not a cosmetic slip, it is the entire
 * accessible content of the signature element in a language the reader may not
 * have. This is precisely the bug the screen-reader pass found on `/de`.
 */
export interface SpecBandWords {
  inSpec: string;
  aboveUpper: string;
  belowLower: string;
  /** Introduces the limits, e.g. `Specification` / `Spezifikation`. */
  specification: string;
  /** Introduces the target value, e.g. `target` / `Ziel`. */
  target: string;
}

export interface SpecBandProps {
  /** What is being measured, e.g. `Electrode porosity`. */
  label: string;
  /** Localised readout vocabulary. See {@link SpecBandWords}. */
  words: SpecBandWords;
  value: number;
  /** Lower specification limit. Below this the part is out of spec. */
  lowerLimit: number;
  /** Upper specification limit. */
  upperLimit: number;
  /** The value the process is aiming at, if there is one. */
  target?: number;
  unit?: string;
  /**
   * Plotted domain. Defaults to the spec window padded by half its width, so
   * an out-of-spec reading is still visible rather than clipped to the edge.
   */
  domain?: readonly [number, number];
  /** Digits after the decimal point, for both the readout and the label. */
  precision?: number;
  className?: string;
}

/**
 * ## The signature element
 *
 * A tolerance band: the in-spec window, the limits that bound it, the target,
 * and where the measurement actually landed. It is the shape a process engineer
 * already reads on a control chart or a calibration certificate, which is the
 * point — the product's most-repeated visual belongs to the domain's own
 * vernacular rather than to generic SaaS.
 *
 * ### Accessibility
 *
 * The bar is `aria-hidden` and the whole component is described by a text
 * readout that states the value, the window and the verdict in words. A screen
 * reader user gets the *conclusion* ("out of spec, above the upper limit"),
 * not a description of a drawing. Out-of-spec is signalled three ways —
 * position, a filled diamond instead of a line, and the word itself — because
 * colour is never the only signal here.
 */
export function SpecBand({
  label,
  words,
  value,
  lowerLimit,
  upperLimit,
  target,
  unit,
  domain,
  precision = 1,
  className,
}: SpecBandProps) {
  const pad = (upperLimit - lowerLimit) / 2;
  const [min, max] = domain ?? [lowerLimit - pad, upperLimit + pad];
  const span = max - min || 1;

  // Clamped so a wild reading pins to the edge instead of drawing outside the
  // viewport; the text readout still carries the true number.
  const pct = (n: number): number => Math.min(100, Math.max(0, ((n - min) / span) * 100));

  const inSpec = value >= lowerLimit && value <= upperLimit;
  const verdict = inSpec ? words.inSpec : value > upperLimit ? words.aboveUpper : words.belowLower;

  const fmt = (n: number): string => n.toFixed(precision);
  const suffix = unit ? ` ${unit}` : '';

  return (
    <figure className={cx('flex flex-col gap-2', className)}>
      <figcaption className="flex items-baseline justify-between gap-4">
        <span className="text-[length:var(--type-ui-size-sm)] font-medium">{label}</span>
        <span
          className={cx(
            'flex items-center gap-1.5 font-(family-name:--type-family-data) text-[length:var(--type-ui-size-sm)] tabular-nums',
            inSpec ? 'text-text-default' : 'text-status-danger-fg',
          )}
        >
          <span aria-hidden="true">{inSpec ? '│' : '◆'}</span>
          {fmt(value)}
          {suffix}
        </span>
      </figcaption>

      <div aria-hidden="true" className="relative h-6">
        {/* Track — the plotted domain. */}
        <div className="bg-band-track absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2" />

        {/* The in-spec window. */}
        <div
          className="bg-band-range absolute top-1/2 h-1.5 -translate-y-1/2"
          style={{
            insetInlineStart: `${String(pct(lowerLimit))}%`,
            inlineSize: `${String(pct(upperLimit) - pct(lowerLimit))}%`,
          }}
        />

        {/* Limit marks — the calibration ticks that give the band its character. */}
        {[lowerLimit, upperLimit].map((limit) => (
          <div
            key={limit}
            className="bg-band-limit absolute top-1/2 h-4 w-px -translate-y-1/2"
            style={{ insetInlineStart: `${String(pct(limit))}%` }}
          />
        ))}

        {target === undefined ? null : (
          <div
            className="bg-band-limit absolute top-1/2 h-3 w-px -translate-y-1/2 opacity-60"
            style={{ insetInlineStart: `${String(pct(target))}%` }}
          />
        )}

        {/*
         * The reading. In spec it is a hairline like the limit marks; out of
         * spec it becomes a filled diamond — a shape change, so the state
         * survives greyscale printing and every form of colour blindness.
         */}
        {inSpec ? (
          <div
            className="bg-band-tick absolute top-1/2 h-6 w-0.5 -translate-x-1/2 -translate-y-1/2"
            style={{ insetInlineStart: `${String(pct(value))}%` }}
          />
        ) : (
          <div
            className="bg-status-danger-fg absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45"
            style={{ insetInlineStart: `${String(pct(value))}%` }}
          />
        )}
      </div>

      <p className="text-text-muted text-[length:var(--type-ui-size-xs)]">
        {fmt(value)}
        {suffix} — {verdict}. {words.specification} {fmt(lowerLimit)}–{fmt(upperLimit)}
        {suffix}
        {target === undefined ? '' : `, ${words.target} ${fmt(target)}${suffix}`}.
      </p>
    </figure>
  );
}
