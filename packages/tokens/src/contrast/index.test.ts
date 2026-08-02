import { describe, expect, it } from 'vitest';

import { contrastRatio, cvdDistance, hueOf, hueSeparation } from './index.js';

describe('contrastRatio', () => {
  it('returns 21 for black on white, the theoretical maximum', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('returns 1 for a colour against itself', () => {
    expect(contrastRatio('#476F95', '#476F95')).toBeCloseTo(1, 2);
  });

  it('is symmetric — order of arguments does not matter', () => {
    const a = contrastRatio('#1C1A17', '#F4F4F1');
    const b = contrastRatio('#F4F4F1', '#1C1A17');
    expect(a).toBeCloseTo(b, 5);
  });

  it('matches the solved anchor: brand on light ground clears 4.5', () => {
    expect(contrastRatio('#476F95', '#F4F4F1')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('hueOf', () => {
  it('reports the oklch hue of the brand accent', () => {
    expect(hueOf('#476F95')).toBeCloseTo(248, 0);
  });

  it('returns 0 for an achromatic colour rather than NaN', () => {
    // culori leaves hue undefined when chroma is zero. Callers do arithmetic
    // on this, so undefined must never escape.
    expect(hueOf('#808080')).toBe(0);
  });

  it('throws on an unparseable colour rather than returning NaN', () => {
    expect(() => hueOf('#gggggg')).toThrow(/#gggggg/);
  });
});

describe('hueSeparation', () => {
  it('measures the short way around the colour wheel', () => {
    // The earlier version of this test used two hues 50 degrees apart and
    // asserted `<= 180`, which is true by construction — it passed even for a
    // plain abs() with no wrap-around at all. These two straddle 0 degrees.
    // #b4608a sits at hue 350, #bc5f70 at hue 10 — the naive abs() gives 340.
    expect(hueSeparation('#b4608a', '#bc5f70')).toBeCloseTo(20, 0);
  });

  it('proves danger and warning are separated by at least 30 degrees', () => {
    expect(hueSeparation('#A75343', '#876620')).toBeGreaterThanOrEqual(30);
  });
});

describe('cvdDistance', () => {
  it('reports near-zero distance for identical colours', () => {
    expect(cvdDistance('#317952', '#317952')).toBeCloseTo(0, 1);
  });

  it('reports a large distance for colours that stay distinct under CVD', () => {
    expect(cvdDistance('#F4F4F1', '#1C1A17')).toBeGreaterThan(20);
  });

  // The parse guards below were the only uncovered branches in this file when
  // the coverage gate went in. They matter more than their size suggests: if
  // an unparseable value returned NaN instead of throwing, every `>=` in the
  // contrast and CVD gates would be false-y and the gate would report a
  // failure it could not explain — or, with a `<=` assertion, pass silently.
  it('throws on an unparseable colour rather than returning NaN', () => {
    expect(() => cvdDistance('not-a-colour', '#317952')).toThrow(/not-a-colour/);
  });

  it('names the second colour when it is the unparseable one', () => {
    // A guard that always reports `a` would pass a test that only ever breaks
    // the first argument.
    expect(() => cvdDistance('#317952', 'not-a-colour')).toThrow(/not-a-colour/);
  });
});
