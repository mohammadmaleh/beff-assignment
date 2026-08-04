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
  /**
   * `hero` is the same instrument at presentation size: the label becomes an
   * eyebrow, the reading is set at readout scale, and the plotted domain is
   * labelled at its ends so the axis is readable rather than implied. One
   * component, two sizes — the signature element must not exist twice, or the
   * two copies drift.
   */
  scale?: 'default' | 'hero';
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
 *
 * ### Motion
 *
 * The parts of the drawing carry `data-part` attributes so a *page* can animate
 * the band drawing itself — the one orchestrated moment the design brief allows.
 * The keyframes deliberately live in the consuming app rather than here: a
 * component library that animates on mount animates in every context it is ever
 * placed in, including twelve at a time on a dashboard.
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
  scale = 'default',
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
  const hero = scale === 'hero';

  return (
    <figure className={cx('flex flex-col', hero ? 'gap-3' : 'gap-2', className)}>
      <figcaption
        className={cx(
          hero
            ? 'flex flex-col gap-3'
            : 'flex items-baseline justify-between gap-4 text-[length:var(--type-ui-size-sm)]',
        )}
      >
        <span
          className={cx(
            hero
              ? 'text-text-muted font-(family-name:--type-family-data) text-[length:var(--type-ui-size-xs)] tracking-[0.14em] uppercase'
              : 'font-medium',
          )}
        >
          {label}
        </span>
        <span
          className={cx(
            'flex items-center font-(family-name:--type-family-data) tabular-nums',
            hero
              ? 'gap-3 text-[length:var(--type-ui-size-readout)] leading-none'
              : 'gap-1.5 text-[length:var(--type-ui-size-sm)]',
            inSpec ? 'text-text-default' : 'text-status-danger-fg',
          )}
        >
          <span aria-hidden="true" className={hero ? 'text-[0.55em]' : undefined}>
            {inSpec ? '│' : '◆'}
          </span>
          {fmt(value)}
          {/*
           * At readout scale the unit is set small and muted, the way it is on a
           * `Metric` tile: a mono space at 56px is a hole in the middle of the
           * figure, and the unit is not part of the number.
           */}
          {hero && unit !== undefined ? (
            <span className="text-text-muted text-[0.34em]">{unit}</span>
          ) : (
            suffix
          )}
        </span>
      </figcaption>

      <div aria-hidden="true" className={cx('relative', hero ? 'h-8' : 'h-6')}>
        {/* Track — the plotted domain. */}
        <div
          className={cx(
            'bg-band-track absolute inset-x-0 top-1/2 -translate-y-1/2',
            hero ? 'h-2.5' : 'h-1.5',
          )}
        />

        {/* The in-spec window. */}
        <div
          data-part="range"
          className={cx(
            'bg-band-range absolute top-1/2 origin-center -translate-y-1/2',
            hero ? 'h-2.5' : 'h-1.5',
          )}
          style={{
            insetInlineStart: `${String(pct(lowerLimit))}%`,
            inlineSize: `${String(pct(upperLimit) - pct(lowerLimit))}%`,
          }}
        />

        {/* Limit marks — the calibration ticks that give the band its character. */}
        {[lowerLimit, upperLimit].map((limit) => (
          <div
            key={limit}
            data-part="limit"
            className={cx(
              'bg-band-limit absolute top-1/2 w-px -translate-y-1/2',
              hero ? 'h-6' : 'h-4',
            )}
            style={{ insetInlineStart: `${String(pct(limit))}%` }}
          />
        ))}

        {target === undefined ? null : (
          <div
            data-part="limit"
            className={cx(
              'bg-band-limit absolute top-1/2 w-px -translate-y-1/2 opacity-60',
              hero ? 'h-4' : 'h-3',
            )}
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
            data-part="tick"
            className={cx(
              'bg-band-tick absolute top-1/2 -translate-x-1/2 -translate-y-1/2',
              hero ? 'h-8 w-[3px]' : 'h-6 w-0.5',
            )}
            style={{ insetInlineStart: `${String(pct(value))}%` }}
          />
        ) : (
          <div
            data-part="tick"
            className={cx(
              'bg-status-danger-fg absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45',
              hero ? 'size-4' : 'size-3',
            )}
            style={{ insetInlineStart: `${String(pct(value))}%` }}
          />
        )}
      </div>

      {/*
       * The plotted domain, labelled only at hero scale. On a dashboard twelve
       * of these stack and the numbers become noise; standing alone, an
       * unlabelled axis asks the reader to take the drawing on trust.
       *
       * Only the two ends. The specification window is already drawn as the
       * filled segment and stated in words below — printing it here as well
       * would put the same figures on screen three times.
       */}
      {hero ? (
        <div
          aria-hidden="true"
          className="text-text-muted flex items-baseline justify-between gap-4 font-(family-name:--type-family-data) text-[length:var(--type-ui-size-xs)] tabular-nums"
        >
          <span>
            {fmt(min)}
            {suffix}
          </span>
          <span>
            {fmt(max)}
            {suffix}
          </span>
        </div>
      ) : null}

      <p
        className={cx(
          'text-text-muted',
          hero
            ? 'max-w-[var(--type-prose-measure)] text-[length:var(--type-ui-size-sm)]'
            : 'text-[length:var(--type-ui-size-xs)]',
        )}
      >
        {fmt(value)}
        {suffix} — {verdict}. {words.specification} {fmt(lowerLimit)}–{fmt(upperLimit)}
        {suffix}
        {target === undefined ? '' : `, ${words.target} ${fmt(target)}${suffix}`}.
      </p>
    </figure>
  );
}
