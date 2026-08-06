'use client';

import { useMemo } from 'react';

import {
  bandOption,
  HERO_BAND,
  STANDARD_BAND,
  useChartTokens,
  useReducedMotion,
  type EChartsOption,
} from '../../lib/chart/index';
import { cx } from '../../lib/cx/index';
import { EChart } from '../EChart/index';

/**
 * The words the text readout is built from.
 *
 * Required, with no English default. The readout is the *only* form of this
 * component a screen reader can perceive - the drawing is `aria-hidden` - so a
 * default in the wrong language is not a cosmetic slip, it is the entire
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
   * component, two sizes - the signature element must not exist twice, or the
   * two copies drift.
   */
  scale?: 'default' | 'hero';
  /**
   * Draw the band on mount, once.
   *
   * Off by default, and the default is the design. A component that animates on
   * mount animates in every context it is ever placed in, including four at a
   * time on a dashboard; the landing page opts in for the one orchestrated
   * moment the design brief allows. `prefers-reduced-motion` overrides it.
   *
   * This replaces the `data-part` attributes the hand-drawn band exposed for the
   * app's stylesheet to key off. An ECharts instance runs its own render loop
   * and is outside the cascade entirely, so the opt-in has to be a prop.
   */
  animate?: boolean;
  className?: string;
}

/**
 * ## The signature element
 *
 * A tolerance band: the in-spec window, the limits that bound it, the target,
 * and where the measurement actually landed. It is the shape a process engineer
 * already reads on a control chart or a calibration certificate, which is the
 * point - the product's most-repeated visual belongs to the domain's own
 * vernacular rather than to generic SaaS.
 *
 * ### The drawing is ECharts, the readout is not
 *
 * The band itself is an ECharts instance built by `bandOption`, so it is drawn
 * by the same layer as every other figure in the product and inherits its
 * tokens, its theme-change handling and its reduced-motion rule. Everything a
 * reader is *told* - the label, the reading, the domain's ends, the verdict -
 * stays as page HTML with real type tokens. That split is deliberate: an
 * ECharts `<text>` node cannot wear `--type-ui-size-readout`, and the readout
 * at hero scale is 56px of the app's own data typeface.
 *
 * ### Accessibility
 *
 * The drawing is `aria-hidden` and the component is described by a text readout
 * that states the value, the window and the verdict in words. A screen reader
 * user gets the *conclusion* ("out of spec, above the upper limit"), not a
 * description of a drawing. Out-of-spec is signalled three ways - position, a
 * filled diamond instead of a line, and the word itself - because colour is
 * never the only signal here.
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
  animate = false,
  className,
}: SpecBandProps) {
  const tokens = useChartTokens();
  const reducedMotion = useReducedMotion();

  const bounds = useMemo<readonly [number, number]>(() => {
    if (domain !== undefined) return domain;
    const pad = (upperLimit - lowerLimit) / 2;
    return [lowerLimit - pad, upperLimit + pad];
  }, [domain, lowerLimit, upperLimit]);

  const inSpec = value >= lowerLimit && value <= upperLimit;
  const verdict = inSpec ? words.inSpec : value > upperLimit ? words.aboveUpper : words.belowLower;

  const fmt = (n: number): string => n.toFixed(precision);
  const suffix = unit ? ` ${unit}` : '';
  const hero = scale === 'hero';

  const option = useMemo<EChartsOption>(
    () =>
      bandOption({
        value,
        lowerLimit,
        upperLimit,
        target,
        domain: bounds,
        inSpec,
        geometry: hero ? HERO_BAND : STANDARD_BAND,
        tokens,
        reducedMotion,
        animate,
      }),
    /*
     * `bounds` is memoised above rather than derived inline, so this list can
     * depend on it by identity. Derived inline it would be a fresh array every
     * render, the memo would never hit, and every render would rebuild the
     * option - which for ECharts is a full `setOption`. With `animate` on, that
     * is the band redrawing itself continuously.
     */
    [value, lowerLimit, upperLimit, target, bounds, inSpec, hero, tokens, reducedMotion, animate],
  );

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

      <EChart option={option} height={hero ? '2rem' : '1.5rem'} />

      {/*
       * The plotted domain, labelled only at hero scale. On a dashboard four of
       * these stack and the numbers become noise; standing alone, an unlabelled
       * axis asks the reader to take the drawing on trust.
       *
       * Set as page HTML rather than as the chart's own axis labels, for the
       * same reason the readout is: these wear `--type-ui-size-xs` and the app's
       * data typeface, which an ECharts axis label cannot. Only the two ends -
       * the specification window is already drawn as the filled segment and
       * stated in words below, and printing it here as well would put the same
       * figures on screen three times.
       */}
      {hero ? (
        <div
          aria-hidden="true"
          className="text-text-muted flex items-baseline justify-between gap-4 font-(family-name:--type-family-data) text-[length:var(--type-ui-size-xs)] tabular-nums"
        >
          <span>
            {fmt(bounds[0])}
            {suffix}
          </span>
          <span>
            {fmt(bounds[1])}
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
        {suffix} - {verdict}. {words.specification} {fmt(lowerLimit)}–{fmt(upperLimit)}
        {suffix}
        {target === undefined ? '' : `, ${words.target} ${fmt(target)}${suffix}`}.
      </p>
    </figure>
  );
}
