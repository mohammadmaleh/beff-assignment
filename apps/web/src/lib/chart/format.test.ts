import { describe, expect, it } from 'vitest';

import { chartFormatters } from './format';

/**
 * The whole reason this module exists is the German number rules. These tests
 * are written against the *rules*, not against the exact glyphs Intl happens to
 * emit, except where the glyph is the point — the non-breaking space before a
 * German percent sign is the point.
 */

const NBSP = ' ';

describe('percent', () => {
  it('renders an English percentage with no space before the sign', () => {
    expect(chartFormatters('en').percent(71.8)).toBe('71.8%');
  });

  it('renders a German percentage with a non-breaking space before the sign', () => {
    // Not cosmetic. A plain space lets the sign wrap alone onto the next line,
    // and no space at all is simply wrong in German typography. Both are what
    // a template literal produces, which is why nothing here concatenates.
    const formatted = chartFormatters('de').percent(71.8);

    expect(formatted).toContain(NBSP);
    expect(formatted).toBe(`71,8${NBSP}%`);
  });

  it('converts from the API convention of 0-100 rather than Intl’s 0-1', () => {
    // The trap this module was written to close: `style: 'percent'` multiplies
    // by 100, so passing 71.8 straight through renders 7 180%.
    expect(chartFormatters('en').percent(100)).toBe('100.0%');
    expect(chartFormatters('en').percent(0)).toBe('0.0%');
  });

  it('uses a comma as the decimal separator in German', () => {
    expect(chartFormatters('de').percent(32.4)).toBe(`32,4${NBSP}%`);
  });
});

describe('euro', () => {
  it('drops the cents', () => {
    // A scrap cost of "4 213,67 €" implies the line knows what it lost to the
    // cent. It does not — the figure is a unit cost times a count.
    expect(chartFormatters('en').euro(4213.67)).not.toContain('.67');
  });

  it('puts the symbol where each locale puts it', () => {
    expect(chartFormatters('en').euro(4214).startsWith('€')).toBe(true);
    expect(chartFormatters('de').euro(4214).endsWith('€')).toBe(true);
  });
});

describe('count', () => {
  it('groups thousands so a cell count is legible at a glance', () => {
    expect(chartFormatters('en').count(1400)).toBe('1,400');
    expect(chartFormatters('de').count(1400)).toBe('1.400');
  });
});

describe('decimal', () => {
  it('pads to the requested number of places so a column does not jitter', () => {
    expect(chartFormatters('en').decimal(238, 1)).toBe('238.0');
  });

  it('rounds rather than truncating', () => {
    expect(chartFormatters('en').decimal(32.449, 1)).toBe('32.4');
    expect(chartFormatters('en').decimal(32.45, 1)).toBe('32.5');
  });
});

describe('dates', () => {
  const iso = '2026-07-31T12:00:00Z';

  it('formats an axis tick without the year', () => {
    // Sixty batches inside one window are all in the same year. Printing it on
    // every tick spends horizontal space on a constant.
    expect(chartFormatters('en').axisDate(iso)).not.toContain('2026');
  });

  it('formats a tooltip date unambiguously, including the year', () => {
    expect(chartFormatters('en').fullDate(iso)).toContain('2026');
  });

  it('formats dates in the reader’s locale', () => {
    expect(chartFormatters('de').fullDate(iso)).not.toBe(chartFormatters('en').fullDate(iso));
  });
});
