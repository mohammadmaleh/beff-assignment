import { describe, expect, it } from 'vitest';

import { HEADLINE_WINDOWS, yieldWindow } from './windows';

describe('yieldWindow', () => {
  it('reads a pilot line against the pilot band', () => {
    // 40–80% is normal on a pilot line and alarming on a production one. The
    // same 71.8% is a pass here and a crisis one line over, which is exactly
    // why a bare number with an arrow cannot answer the question.
    expect(yieldWindow('pilot')).toEqual({ lowerLimit: 40, upperLimit: 80, target: 70 });
  });

  it('reads a production line against the production band', () => {
    expect(yieldWindow('production')).toEqual({ lowerLimit: 85, upperLimit: 97, target: 92 });
  });

  it('falls back to the stricter band for an unknown kind', () => {
    // If the API ever grows a third kind, judging it by the *pilot* band would
    // silently call a failing production line healthy. Erring strict means the
    // wrong answer is a false alarm, not a missed one.
    expect(yieldWindow('something-new')).toEqual(yieldWindow('production'));
  });

  it('puts every target inside its own window', () => {
    for (const kind of ['pilot', 'production'] as const) {
      const w = yieldWindow(kind);
      expect(w.target).toBeGreaterThan(w.lowerLimit);
      expect(w.target).toBeLessThan(w.upperLimit);
    }
  });
});

describe('HEADLINE_WINDOWS', () => {
  it('bands capacity retention at the end-of-life threshold', () => {
    // ~80% at 1000 cycles is the common automotive end-of-life threshold, so
    // this is a real limit rather than a range someone found tidy.
    expect(HEADLINE_WINDOWS.retention).toEqual({ lowerLimit: 80, upperLimit: 100, target: 90 });
  });

  it('gives scrap rate and CO₂ no window at all', () => {
    // The design brief is explicit: the band appears only where a real
    // measurement meets a real limit. Total scrap rate has no specification -
    // it is the inverse of yield - and CO₂ intensity has a typical range, which
    // is not the same thing as a limit. Banding them would spend the signature
    // element on decoration and imply precision nobody agreed to.
    expect(HEADLINE_WINDOWS).not.toHaveProperty('scrap');
    expect(HEADLINE_WINDOWS).not.toHaveProperty('co2');
  });
});
