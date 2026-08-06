/**
 * The chart layer of the design system.
 *
 * Everything here is about *how a chart is drawn* - the ECharts build, the
 * palette it reads, the axis defaults, the nice-number scale, the tooltip
 * plumbing. Nothing here knows what a batch or a process step is. The charts
 * that do know live in the app that owns the domain, and compose these.
 *
 * That split is the reason this moved out of `apps/web`: an axis style and a
 * reference-line rule are design-system decisions in exactly the way a button's
 * focus ring is, and leaving them beside the domain charts meant a second app
 * could not draw a chart that looked like this one without copying six files.
 */

export { bandOption, HERO_BAND, STANDARD_BAND } from './band';
export type { BandGeometry, BandOptionInput } from './band';
export { baseOption, categoryAxis, referenceLine, valueAxis } from './base';
export type { BaseOptionInput } from './base';
export { echarts } from './echarts';
export type { EChartsOption } from './echarts';
export { binPosition, histogram } from './histogram';
export type { Bin, HistogramOptions } from './histogram';
export { niceBounds } from './scale';
export type { Bounds, BoundsOptions } from './scale';
export { useReducedMotion } from './motion';
export { readChartTokens, useChartTokens } from './tokens';
export type { ChartTokenName, ChartTokens } from './tokens';
export { pointAt, seriesTooltip, strong, tooltipHtml } from './tooltip';
