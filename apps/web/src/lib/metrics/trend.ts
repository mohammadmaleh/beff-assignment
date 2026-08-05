/**
 * Which way a period-on-period movement points.
 *
 * `Metric` takes the direction as a word rather than a number because the arrow
 * it draws needs a spoken equivalent — colour and glyph are never the only
 * signal — and because zero is a real answer that neither "up" nor "down"
 * covers. A ternary written at the call site gets `delta > 0 ? 'up' : 'down'`
 * about right and drops `flat`, which then renders a rising arrow for a period
 * that did not move.
 *
 * Deliberately says nothing about whether the movement is *good*. Falling scrap
 * and falling yield are the same direction and opposite news, so `intent` stays
 * the caller's judgement — see how the dashboard sets it for scrap rate.
 */
export type Trend = 'up' | 'down' | 'flat';

export function deltaTrend(delta: number): Trend {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}
