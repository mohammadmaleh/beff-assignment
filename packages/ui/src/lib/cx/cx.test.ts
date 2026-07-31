import { describe, expect, it } from 'vitest';

import { cx } from './cx';

describe('cx', () => {
  it('joins the truthy parts', () => {
    expect(cx('a', 'b')).toBe('a b');
  });

  it('drops falsy parts rather than emitting "false" or "undefined"', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('returns an empty string when nothing survives', () => {
    expect(cx(false, undefined)).toBe('');
  });
});
