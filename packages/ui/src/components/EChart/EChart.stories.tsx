import {
  baseOption,
  categoryAxis,
  niceBounds,
  referenceLine,
  useChartTokens,
  useReducedMotion,
  valueAxis,
  type EChartsOption,
} from '../../lib/chart/index';

import { EChart } from './EChart';

import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * One ECharts instance in a div, kept alive correctly - and nothing else.
 *
 * ## It is `aria-hidden`, and that is the design
 *
 * There is no `role="img"` and no generated `aria-label`. An ECharts SVG holds
 * dozens of `<text>` nodes - axis ticks, labels, the legend - and left exposed a
 * screen reader walks all of them, in visual order, with no structure: "71.8 68
 * B-2026-004 65.2". Hiding the drawing and exposing a table is not a compromise
 * for accessibility's sake; it is the only version that is readable.
 * `ChartFigure` owns the table.
 *
 * ## The two things it gets right that are easy to get wrong
 *
 * The instance is a **ref**, not state - React's reconciliation and ECharts'
 * own disposal otherwise race on unmount. And it watches its box with a
 * `ResizeObserver` rather than a window `resize` listener: the window does not
 * resize when a sidebar collapses or when a German string wraps to a second
 * line and pushes the section wider, and a window listener sees none of it.
 *
 * ## What the option builders are for
 *
 * ECharts' defaults are a different design system - 12px sans-serif, a solid
 * grey axis, a full grid, a dark tooltip, a palette that is not colourblind
 * safe. `baseOption`, `categoryAxis`, `valueAxis` and `referenceLine` are that
 * overridden once instead of per chart, which is how a dashboard avoids ending
 * up with three greys.
 */
const POINTS = [68.2, 71.8, 74.1, 65.4, 77.6, 73.2, 70.9, 72.4];
const LABELS = ['2 Jun', '9 Jun', '16 Jun', '23 Jun', '30 Jun', '7 Jul', '14 Jul', '21 Jul'];

function TrendChart({ withReference }: { withReference: boolean }) {
  const tokens = useChartTokens();
  const reducedMotion = useReducedMotion();

  const bounds = niceBounds([...POINTS, ...(withReference ? [69, 80] : [])], {
    padRatio: 0.18,
    minPad: 2,
    maxIntervals: 5,
    clampMin: 0,
    clampMax: 100,
  });

  const option: EChartsOption = {
    ...baseOption({ tokens, reducedMotion }),
    xAxis: categoryAxis(tokens, { data: LABELS }),
    yAxis: valueAxis(tokens, { ...bounds }),
    series: [
      {
        type: 'line',
        name: 'Measured',
        data: POINTS,
        lineStyle: { width: 2, color: tokens['color-chart-series-1'] },
        itemStyle: { color: tokens['color-chart-series-1'] },
        showSymbol: false,
        ...(withReference
          ? {
              markLine: {
                silent: true,
                symbol: 'none',
                data: [
                  referenceLine(tokens, { value: 80, label: 'Upper limit', strong: true }),
                  referenceLine(tokens, { value: 69, label: 'Cohort median' }),
                ],
              },
            }
          : {}),
      },
    ],
  };

  return <EChart option={option} height="20rem" />;
}

/*
 * The stories are of `TrendChart`, not of `EChart` directly, and that is the
 * honest framing rather than a workaround: `EChart` takes a fully built
 * `EChartsOption`, and every option in this system is assembled from the token
 * values and the reduced-motion preference *at render time*. A story passing a
 * literal option would be a story of a chart nobody draws.
 */
const meta = {
  title: 'Charts/EChart',
  component: TrendChart,
  parameters: { layout: 'fullscreen' },
  args: { withReference: true },
} satisfies Meta<typeof TrendChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Flip the theme in the toolbar. The chart follows - `useChartTokens` reads the
 * resolved custom properties off `<html>` and re-reads on both paths that can
 * change them: the `data-theme` attribute a toggle writes, and the OS crossing
 * its own light/dark schedule, which touches no attribute at all.
 *
 * A canvas cannot inherit from CSS, so it has to be told.
 */
export const Line: Story = { args: { withReference: false } };

/**
 * A rule you are judged against is **dashed and neutral**, never solid and
 * never in a series colour. That pair of rules is what lets a reader tell a
 * measurement from the thing measuring it without a legend - and it survives
 * greyscale, colour blindness and a printout, which a legend does not, because
 * a legend only tells you which colour is which.
 *
 * The limits are also only drawn when they are **on the axis**. Clamped to the
 * edge, a limit reads as "you are at the limit", which on a line running 65%
 * against an 80% ceiling would be a lie.
 */
export const WithReferenceLines: Story = { args: { withReference: true } };

/**
 * Two side by side, which is what the `ResizeObserver` is for: neither is at
 * the width it was initialised at, and neither triggers a window `resize`.
 */
export const SideBySide: Story = {
  render: () => (
    <div className="grid gap-8 lg:grid-cols-2">
      <TrendChart withReference />
      <TrendChart withReference={false} />
    </div>
  ),
};
