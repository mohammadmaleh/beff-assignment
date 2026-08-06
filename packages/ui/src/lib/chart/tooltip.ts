/**
 * The two things every tooltip in this app has to do, in one place.
 *
 * ## Why `pointAt` exists
 *
 * ECharts hands a formatter either one params object or an array of them,
 * depending on whether the tooltip is triggered by `item` or by `axis` - and
 * for a stacked bar, an array whose length is the number of series. Every chart
 * here needs the same thing out of it: *which point of mine is being hovered*.
 *
 * Written inline that was four copies of
 * `Array.isArray(params) ? params[0] : params`, each with its own cast, and
 * each a place where an out-of-range `dataIndex` would read `undefined.value`
 * and throw inside a render loop React cannot catch.
 *
 * ## Why the tooltip content is built by pure functions
 *
 * A formatter passed straight to ECharts is only ever executed on hover, which
 * means it is never executed under test - the charts' tooltips were the one
 * part of this layer with no coverage and the most string-assembly per line.
 * Splitting the *content* from the *callback* makes the content a unit, and the
 * callback a two-line adapter with nothing left in it to get wrong.
 */

/** ECharts' formatter params, narrowed to the one field every chart reads. */
interface FormatterParams {
  dataIndex?: number;
}

/**
 * The caller's own data point for whatever ECharts is asking about.
 *
 * Returns `undefined` rather than throwing on an index the series does not
 * have. A tooltip is drawn during a hover, so an exception here surfaces as a
 * blank chart and a console trace with no user action attached to it.
 */
export function pointAt<T>(params: unknown, points: readonly T[]): T | undefined {
  const first = (Array.isArray(params) ? params[0] : params) as FormatterParams | undefined;
  const index = first?.dataIndex;
  return index === undefined ? undefined : points[index];
}

/**
 * Join tooltip lines into the HTML ECharts expects.
 *
 * Falsy entries are dropped, so a caller can write a conditional line inline
 * without assembling an array first.
 */
export function tooltipHtml(lines: readonly (string | false | null | undefined)[]): string {
  return lines
    .filter((line): line is string => typeof line === 'string' && line !== '')
    .join('<br>');
}

/** Bold, for the one line in a tooltip that names what is being read. */
export function strong(text: string): string {
  return `<strong>${text}</strong>`;
}

/**
 * The adapter between ECharts' formatter contract and a chart's own content.
 *
 * Each chart was repeating the same three lines - resolve the point, bail on
 * `undefined`, render - which is three lines of nothing per chart and one more
 * place for the bail to be forgotten. Forgetting it is not a visible bug until
 * a hover lands on an index the series does not have, at which point the chart
 * throws inside ECharts' render loop and goes blank.
 *
 * With the guard here, `render` is handed a point that exists and can be a pure
 * function of it - which is what makes every tooltip in this app testable
 * without mounting a chart.
 */
export function seriesTooltip<T>(
  points: readonly T[],
  render: (point: T) => string,
): (params: unknown) => string {
  return (params: unknown) => {
    const point = pointAt(params, points);
    return point === undefined ? '' : render(point);
  };
}
