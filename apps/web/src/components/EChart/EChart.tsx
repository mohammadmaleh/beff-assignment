'use client';

import { useEffect, useRef } from 'react';

import { echarts, type EChartsOption } from '@/lib/chart/echarts';

/**
 * Mounts one ECharts instance into a div and keeps it alive correctly.
 *
 * ## This element is `aria-hidden`, and that is the design
 *
 * `ScrapChart` established the inversion this app uses for every chart: the
 * drawing is a fast visual index, and the `<table>` beside it is the
 * authoritative rendering. A chart built that way cannot drift out of sync with
 * its own description, because there is only one set of numbers and the table
 * is it.
 *
 * So there is no `role="img"` and no generated `aria-label` here. An ECharts
 * SVG contains dozens of `<text>` nodes — axis ticks, labels, the legend — and
 * left exposed a screen reader walks all of them, in visual order, with no
 * structure: "71.8 68 B-2026-004 65.2". Hiding the drawing and exposing the
 * table is not a compromise for accessibility's sake; it is the only version
 * that is actually readable. `ChartFigure` owns the table.
 *
 * ## Why the instance is not state
 *
 * ECharts owns a DOM subtree and a render loop. Putting it in `useState` makes
 * React's reconciliation and ECharts' own disposal race on unmount, which shows
 * up as "There is a chart instance already initialized on the dom" in
 * development and as a leaked resize listener in production. A ref and an
 * explicit `dispose()` is the boring, correct shape.
 */
export function EChart({
  option,
  height,
  className,
}: {
  option: EChartsOption;
  /** In `rem`, so the chart scales with the reader's text size. */
  height: string;
  className?: string;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const instance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const element = container.current;
    if (element === null) return;

    const chart = echarts.init(element, undefined, { renderer: 'svg' });
    instance.current = chart;

    /*
     * `ResizeObserver`, not a window `resize` listener.
     *
     * The window does not resize when the sidebar collapses, when a `<details>`
     * above the chart opens, or when a German string wraps to a second line and
     * pushes the section wider. All three change this element's box, and a
     * window listener sees none of them — the chart keeps its old width and
     * either overflows its container or leaves a gap.
     */
    const observer = new ResizeObserver(() => {
      chart.resize();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      chart.dispose();
      instance.current = null;
    };
  }, []);

  useEffect(() => {
    // `notMerge` — the option is rebuilt from scratch whenever the data, the
    // locale or the theme changes, so merging would leave the *previous*
    // option's series behind when a chart legitimately has fewer of them.
    instance.current?.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div
      ref={container}
      aria-hidden="true"
      className={className}
      style={{ blockSize: height, inlineSize: '100%' }}
    />
  );
}
