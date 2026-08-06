/**
 * The ECharts build this app actually uses.
 *
 * ## Why not `import * as echarts from 'echarts'`
 *
 * That entry point registers every chart type, every component and both
 * renderers - roughly a megabyte of JavaScript for four charts that use two
 * series types between them. `echarts/core` plus an explicit `use()` is the
 * library's own supported way to pay for what you render, and it keeps the
 * cost of adding a fifth chart visible: a new chart type is a new import here,
 * in one file, rather than something that silently arrives.
 *
 * ## Why the SVG renderer
 *
 * Canvas is the right answer for tens of thousands of points. A pilot line
 * produces sixty batches a window, so the trade goes the other way, and SVG
 * buys three things that matter more here than throughput: text stays real
 * text (so browser zoom and forced-colors mode behave), output is crisp at any
 * device pixel ratio without redrawing, and the whole thing renders in jsdom -
 * which means the chart components are unit-testable at all. `canvas` in
 * vitest needs a native module this repo does not carry.
 */

import { BarChart, LineChart } from 'echarts/charts';
import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

import type { EChartsOption } from 'echarts';

echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  // The two components that draw a *reference* rather than data: specification
  // limits, cohort percentiles, targets. Without them a control chart is a
  // squiggle with no verdict in it.
  MarkLineComponent,
  MarkAreaComponent,
  // `SpecBand`'s out-of-spec reading. The band is drawn entirely from marks
  // rather than from a series - see `band.ts` - and the diamond is the one part
  // of it that is a point rather than a line.
  MarkPointComponent,
  DatasetComponent,
  SVGRenderer,
]);

export { echarts };
export type { EChartsOption };
