import type { BaseOptionInput } from './base';
import type { EChartsOption } from './echarts';

/**
 * The tolerance band, as an ECharts option.
 *
 * ## Why a chart type that does not exist
 *
 * ECharts has no "value against a specification window" series, and the nearest
 * stock answers are all wrong in the same way: a gauge is round and reads as a
 * dial, a stacked bar makes the window look like a quantity that was accumulated
 * rather than a rule, and a boxplot describes a distribution this figure does not
 * have. So the band is drawn out of primitives — a horizontal rule for the track,
 * a second one for the window, verticals for the limits and the reading.
 *
 * All of it is `markLine`, which is what makes that practical: a `markLine` datum
 * is a *pair of coordinates*, so each mark's length, thickness and colour are set
 * independently. A series would have to share one style across every point.
 *
 * ## The coordinate system
 *
 * `x` is the measurement's own unit — porosity per cent, millimetres, whatever the
 * caller passed — pinned to the plotted domain so the axis cannot drift with the
 * data. `y` is a unitless 0–1 with the instrument centred on 0.5, so the geometry
 * below reads as fractions of the graphic's height and one set of numbers serves
 * every size the band is rendered at.
 *
 * ## Why this is in the design system and not in the app
 *
 * Same rule as the rest of this folder: nothing here knows what porosity is. It
 * takes a value, a window and a domain. `SpecBand` is the component that knows
 * this is a manufacturing readout, and the app is what knows which reading to put
 * in it.
 */

/** Where the parts of the instrument sit, as fractions of the plot height. */
export interface BandGeometry {
  /** Thickness of the track and the window, in px. */
  track: number;
  /** Height of a limit mark. */
  limit: number;
  /** Height of the target mark, which is deliberately shorter than a limit. */
  target: number;
  /** Height of the reading. Full-height at both sizes — it is the answer. */
  tick: number;
  /** Width of the in-spec reading, in px. */
  tickWidth: number;
  /** Diameter of the out-of-spec diamond, in px. */
  marker: number;
}

/** The dashboard band. Four of these stack in a panel, so it stays quiet. */
export const STANDARD_BAND: BandGeometry = {
  track: 6,
  limit: 0.67,
  target: 0.5,
  tick: 1,
  tickWidth: 2,
  marker: 12,
};

/** The same instrument at presentation size, for a hero. */
export const HERO_BAND: BandGeometry = {
  track: 10,
  limit: 0.75,
  target: 0.5,
  tick: 1,
  tickWidth: 3,
  marker: 16,
};

export interface BandOptionInput extends BaseOptionInput {
  value: number;
  lowerLimit: number;
  upperLimit: number;
  // `| undefined` explicitly: `exactOptionalPropertyTypes` is on, and the
  // component's own `target` is optional, so it arrives as `number | undefined`
  // rather than as an absent key.
  target?: number | undefined;
  /** The plotted domain. The component decides it; this only draws it. */
  domain: readonly [number, number];
  /**
   * Whether the reading is inside the window.
   *
   * Passed in rather than derived. The component states the same verdict in
   * words in its readout, and a drawing that decided it independently could
   * disagree with the sentence beside it — on a boundary value, which is exactly
   * where a reader is looking.
   */
  inSpec: boolean;
  geometry: BandGeometry;
  /**
   * Opt in to the draw-on-mount animation.
   *
   * Off by default, and that default is the point. ECharts animates on first
   * draw *and* on every `setOption`, so a band that animated by default would
   * redraw itself whenever the theme changed — four at a time on the dashboard.
   * The landing page opts in for the one orchestrated moment the design brief
   * allows. This replaces the `data-part` CSS hooks the hand-drawn band exposed:
   * an ECharts instance owns its own render loop and is out of the cascade's
   * reach, so a stylesheet cannot animate it.
   */
  animate?: boolean;
}

interface MarkStyle {
  color: string;
  width: number;
  /**
   * Always set, never left to default.
   *
   * ECharts draws `markLine` **dashed** unless told otherwise — it assumes a
   * mark is a threshold. Every part of this instrument is solid: the track, the
   * window, the limits and the reading are all things that *are*, not rules
   * something is judged against, and this app spends `dashed` on exactly that
   * distinction (see `referenceLine`). Left to the default the band renders as
   * a dashed sketch of itself, which no test asserting positions would catch
   * and no reader would report as a bug — it just looks provisional.
   */
  type: 'solid' | 'dashed';
  opacity?: number;
}

/**
 * Where a mark starts. Styling rides here and nowhere else — ECharts reads
 * `lineStyle` off the first end of the pair and ignores it on the second, which
 * is why the helpers below take it as a parameter rather than letting each call
 * site choose an end to put it on.
 *
 * Required rather than optional, and that is not tidiness: ECharts declares its
 * own `lineStyle?: LineStyleOption` without `| undefined`, so under
 * `exactOptionalPropertyTypes` an optional field here cannot be assigned into
 * it at all.
 */
interface MarkStart {
  coord: [number, number];
  lineStyle: MarkStyle;
}

interface MarkEnd {
  coord: [number, number];
}

/**
 * One mark, as ECharts' two-dimensional `markLine` datum: where it starts and
 * where it ends.
 *
 * A tuple rather than an array, and that is load-bearing. `MarkLine2DDataItem`
 * requires exactly two elements, so a plain array widens to something ECharts'
 * own types reject — and the error surfaces on the `series` property, dozens of
 * lines from the helper that produced it.
 */
type Mark = [MarkStart, MarkEnd];

/** A vertical mark of `height` (as a fraction of the plot), centred on the band. */
function vertical(x: number, height: number, lineStyle: MarkStyle): Mark {
  const half = Math.min(height, 1) / 2;
  return [{ coord: [x, 0.5 - half], lineStyle }, { coord: [x, 0.5 + half] }];
}

/** A horizontal run along the band's midline. */
function horizontal(from: number, to: number, lineStyle: MarkStyle): Mark {
  return [{ coord: [from, 0.5], lineStyle }, { coord: [to, 0.5] }];
}

export function bandOption({
  value,
  lowerLimit,
  upperLimit,
  target,
  domain,
  inSpec,
  geometry,
  tokens,
  reducedMotion,
  animate = false,
}: BandOptionInput): EChartsOption {
  const [min, max] = domain;

  // Clamped so a wild reading pins to the edge instead of being drawn outside
  // the plot; the component's text readout still carries the true number.
  const plotted = Math.min(max, Math.max(min, value));

  const marks = [
    horizontal(min, max, {
      color: tokens['color-band-track'],
      width: geometry.track,
      type: 'solid',
    }),
    // After the track, always. Both are rules of the same weight on the same
    // line, so paint order is the only thing that distinguishes them — reversed,
    // the specification window simply is not there.
    horizontal(lowerLimit, upperLimit, {
      color: tokens['color-band-range'],
      width: geometry.track,
      type: 'solid',
    }),
    ...[lowerLimit, upperLimit].map((limit) =>
      vertical(limit, geometry.limit, {
        color: tokens['color-band-limit'],
        width: 1,
        type: 'solid',
      }),
    ),
    ...(target === undefined
      ? []
      : [
          vertical(target, geometry.target, {
            color: tokens['color-band-limit'],
            width: 1,
            type: 'solid',
            opacity: 0.6,
          }),
        ]),
    // In spec the reading is a hairline like the limit marks. Out of spec it is
    // a diamond instead — a shape change, so the state survives greyscale and
    // every form of colour blindness rather than resting on the red alone.
    ...(inSpec
      ? [
          vertical(plotted, geometry.tick, {
            color: tokens['color-band-tick'],
            width: geometry.tickWidth,
            type: 'solid',
          }),
        ]
      : []),
  ];

  return {
    animation: animate && !reducedMotion,
    animationDuration: 420,
    backgroundColor: 'transparent',
    // No furniture. Every default ECharts would bring — an axis line, a
    // gridline, a hover tooltip — is a plot's apparatus arriving uninvited into
    // a 24px-tall readout.
    grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false },
    tooltip: { show: false },
    xAxis: { type: 'value', min, max, show: false },
    yAxis: { type: 'value', min: 0, max: 1, show: false },
    series: [
      {
        type: 'line',
        // One silent, invisible point. `markLine` and `markPoint` are properties
        // of a series, not of the chart, so there has to be a series for them to
        // hang on — and an empty one is not laid out at all.
        data: [[min, 0.5]],
        symbol: 'none',
        silent: true,
        lineStyle: { width: 0 },
        markLine: {
          silent: true,
          // The default is an arrowhead at the far end, which would turn every
          // limit mark into a direction.
          symbol: ['none', 'none'],
          label: { show: false },
          animation: animate && !reducedMotion,
          data: marks,
        },
        markPoint: {
          silent: true,
          symbol: 'diamond',
          symbolSize: geometry.marker,
          label: { show: false },
          animation: animate && !reducedMotion,
          data: inSpec
            ? []
            : [
                {
                  // Required by `MarkPointDataItemOption` even though the label
                  // is off, so it is never rendered or announced. The drawing is
                  // `aria-hidden`; the verdict a reader is given is the
                  // component's text readout, in the caller's own language.
                  name: 'reading',
                  coord: [plotted, 0.5] as [number, number],
                  symbol: 'diamond',
                  itemStyle: { color: tokens['color-status-danger-fg'] },
                },
              ],
        },
      },
    ],
  };
}
