import { describe, expect, it } from 'vitest';

import { deltaTrend } from './trend';

/**
 * Three answers, and the third is the one that gets dropped.
 *
 * Written inline at a call site this is `delta > 0 ? 'up' : 'down'`, which is
 * right twice and silently wrong once: a period that did not move renders a
 * falling arrow and a screen reader says "down". Nothing fails, and the only
 * way to notice is to have a week where a figure is genuinely flat.
 */
describe('deltaTrend', () => {
  it('reads a rise as up', () => {
    expect(deltaTrend(1.4)).toBe('up');
  });

  it('reads a fall as down', () => {
    expect(deltaTrend(-0.2)).toBe('down');
  });

  it('reads no movement as flat, not as a fall', () => {
    expect(deltaTrend(0)).toBe('flat');
  });

  it('says nothing about whether the movement is good news', () => {
    // Falling scrap and falling yield are the same direction and opposite news.
    // `intent` is the caller's judgement; this is only the arrow's direction.
    expect(deltaTrend(-1)).toBe(deltaTrend(-99));
  });
});
