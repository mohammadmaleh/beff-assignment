import type { ReactNode } from 'react';

import { cx } from '../../lib/cx/index';

/**
 * Body copy at a readable measure.
 *
 * ## The measure is the point
 *
 * `max-w-[var(--type-prose-measure)]` was repeated thirty-one times, and it is
 * the one class in the string that a paste can silently drop. A paragraph that
 * loses it does not look broken — it looks *wider*, which reads as fine on the
 * laptop it was written on and becomes a 140-character line on a 1440px screen,
 * where the eye loses its place returning to the start of the next line. The
 * measure is a legibility constraint, not a layout preference, so it belongs to
 * the component rather than to whoever remembers it.
 *
 * ## Two sizes, and why the small one has no leading override
 *
 * `md` is the reading size and carries `--type-prose-leading` with it, because
 * a longer line needs more leading to track. `sm` is the supporting note — a
 * figure description, a caption, a hint under a control — where the text is
 * short enough that the UI leading is correct and the prose leading would make
 * two lines look like two paragraphs.
 *
 * German runs roughly 30% longer than English, so every one of these wraps at a
 * different point in the two locales. That is the reason the measure is set in
 * `ch`-derived tokens rather than in pixels, and the reason it is worth having
 * exactly one of.
 */
export type LedeSize = 'sm' | 'md' | 'lg';

const SIZES: Record<LedeSize, string> = {
  sm: 'text-[length:var(--type-ui-size-sm)]',
  md: 'text-[length:var(--type-prose-size-md)] leading-(--type-prose-leading)',
  lg: 'text-[length:var(--type-prose-size-lg)] leading-(--type-prose-leading)',
};

export function Lede({
  as: Tag = 'p',
  size = 'md',
  className,
  id,
  children,
}: {
  as?: 'p' | 'div' | 'span' | 'li' | 'dd';
  size?: LedeSize;
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      id={id}
      className={cx('text-text-muted max-w-[var(--type-prose-measure)]', SIZES[size], className)}
    >
      {children}
    </Tag>
  );
}
