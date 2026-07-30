import { describe, expect, it } from 'vitest';

import { tokens } from '../../dist/tokens.js';
import { contrastRatio, hueSeparation } from './index.js';
import { pairs } from './pairs.js';

const THEMES = ['light', 'dark'] as const;

describe.each(THEMES)('contrast — %s theme', (theme) => {
  it.each(pairs)('$name clears $threshold:1', ({ fg, bg, threshold }) => {
    expect(contrastRatio(tokens[theme][fg], tokens[theme][bg])).toBeGreaterThanOrEqual(threshold);
  });
});

describe.each(THEMES)('brand separation — %s theme', (theme) => {
  // Roadmap decision #8 — "the brand accent never collides with status
  // colours" — is prose, and prose does not fail a build. Green means *in
  // spec* in a yield chart; a brand drifting toward green makes every chart
  // ambiguous.
  const statuses = [
    'color-status-success-fg',
    'color-status-warning-fg',
    'color-status-danger-fg',
  ] as const;

  it.each(statuses)('brand is at least 30 degrees from %s', (status) => {
    // Hues are read off the tokens themselves rather than compared against
    // hardcoded degrees. Hardcoding would let this pass while the palette
    // drifted underneath it.
    expect(
      hueSeparation(tokens[theme]['color-brand-default'], tokens[theme][status]),
    ).toBeGreaterThanOrEqual(30);
  });
});
