import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { COMMITTED_VALUE_EUR, COMMITTED_VALUE_PCT, committedValueCurve } from './committed';
import { PROCESS_STEPS } from './steps';

describe('committed value', () => {
  it('covers every process step and nothing else', () => {
    // A missing step would draw a gap in the figure; an extra one would draw a
    // step that does not exist in the schema.
    expect(Object.keys(COMMITTED_VALUE_EUR).sort()).toEqual([...PROCESS_STEPS].sort());
  });

  it('matches the euro figures the backend seeds', () => {
    /*
     * The landing page argues from this curve and the dashboard costs its scrap
     * against the same numbers. Two copies of one economic claim is exactly the
     * shape that drifts, and the drift would be invisible: both surfaces would
     * still render, each with a plausible number the other contradicts.
     *
     * `join(process.cwd(), …)` rather than `new URL(…, import.meta.url)`: Vite
     * rewrites the latter into asset resolution at transform time, and a test
     * that reads its own source instead of the intended file passes for the
     * wrong reason.
     */
    const seed = readFileSync(
      join(process.cwd(), '..', 'api', 'src', 'beff', 'seed', 'seed.py'),
      'utf8',
    );
    const block = /COMMITTED_VALUE: dict\[str, Decimal\] = \{([\s\S]*?)\}/.exec(seed)?.[1];
    expect(block, 'COMMITTED_VALUE not found in seed.py').toBeDefined();

    const fromPython: Record<string, number> = {};
    for (const [, step, value] of block!.matchAll(/"(\w+)":\s*Decimal\("([\d.]+)"\)/g)) {
      fromPython[step!] = Number(value);
    }

    expect(fromPython).toEqual({ ...COMMITTED_VALUE_EUR });
  });

  it('never decreases along the chain', () => {
    // The claim the whole figure makes. Cost that came back out at some step
    // would make "a cell scrapped later destroys more value" false, and the
    // drawing would show it as a dip nobody could explain.
    const pcts = committedValueCurve.map((point) => point.pct);
    for (const [i, pct] of pcts.entries()) {
      if (i === 0) continue;
      expect(pct).toBeGreaterThanOrEqual(pcts[i - 1]!);
    }
  });

  it('is in process order, not sorted by magnitude', () => {
    expect(committedValueCurve.map((point) => point.step)).toEqual([...PROCESS_STEPS]);
  });

  it('ends at the finished cell and starts well below it', () => {
    expect(COMMITTED_VALUE_PCT.eol_test).toBe(100);
    expect(COMMITTED_VALUE_PCT.mixing).toBeLessThan(20);
  });

  it('keeps the two figures the landing copy quotes', () => {
    // The body text states 90 per cent at formation against 21 at coating. If
    // the curve moves and the sentence does not, the page argues from numbers
    // its own drawing contradicts.
    expect(COMMITTED_VALUE_PCT.formation).toBe(90);
    expect(COMMITTED_VALUE_PCT.coating).toBe(21);
  });
});
