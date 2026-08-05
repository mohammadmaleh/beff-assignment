import type { ReactNode } from 'react';

import { cx } from '../../lib/cx/index';

/**
 * The small letter-spaced label in the data face: a section kicker, a figure's
 * caption, a column header, the ordinal on a chain marker.
 *
 * ## Why the tracking is not negotiable
 *
 * `0.14em` appeared as a magic number in eight places, and it is the one value
 * here that is genuinely load-bearing: uppercase text set at `xs` without added
 * letter-spacing is measurably harder to read, because the shapes that
 * distinguish lowercase letters are gone and the remaining rectangles run
 * together. A copy of this style that lost the tracking would not look broken —
 * it would just be worse to read, which is exactly the kind of regression no
 * test catches.
 *
 * ## Not a heading
 *
 * Defaults to `<p>`, and every existing use is a `<p>` or a `<span>`. An
 * eyebrow above a heading is *not* a heading — marking it `<h2>` puts a
 * two-word fragment into the document outline above the heading it introduces,
 * and a screen-reader user navigating by heading lands on "PRODUCTION LINE"
 * instead of on the section's actual title.
 */
export function Eyebrow({
  as: Tag = 'p',
  className,
  id,
  children,
}: {
  as?: 'p' | 'span' | 'div';
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      id={id}
      className={cx(
        'text-text-muted font-(family-name:--type-family-data) text-[length:var(--type-ui-size-xs)] tracking-[0.14em] uppercase',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
