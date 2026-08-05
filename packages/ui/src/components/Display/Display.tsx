import type { ReactNode, Ref } from 'react';

import { cx } from '../../lib/cx/index';

/**
 * A heading in the display face.
 *
 * ## Why this exists
 *
 * The class string was written out **thirty-four times** across fourteen files,
 * in nine near-identical spellings. That is not a tidiness complaint: three of
 * those spellings differed only in `leading`, and nobody could say which
 * difference was a decision and which was a paste that drifted. A type scale
 * that lives in thirty-four string literals is not a scale — it is thirty-four
 * chances to be slightly off it, and every one of them still renders something
 * plausible, so nothing ever fails.
 *
 * The face itself is the reason it has to be one component. `Archivo Expanded`
 * is not a family; it is `wdth: 125` on the Archivo variable font, so the
 * typeface only appears at all when `font-(family-name:--type-family-display)`
 * and `[font-stretch:125%]` are set **together**. Either one alone renders a
 * heading that looks nearly right and is not the brand's face.
 *
 * ## `balance`
 *
 * Tight leading and `text-balance`, which is what a *band* heading wants — a
 * two- or three-line statement opening a section, where an orphaned last word
 * is the whole visual problem. A page title of one line wants neither, and
 * asking for both would have `text-wrap: balance` do work on a line that has no
 * wrapping to balance.
 *
 * The tightening scales with the size, because it has to: at `4xl` the lines
 * are close enough that 1.05 opens a visible gap, and at `2xl` 0.98 collides.
 * That relationship is the one thing a per-call-site class string could never
 * hold on to.
 */
export type DisplaySize = 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

const SIZES: Record<DisplaySize, string> = {
  lg: 'text-[length:var(--type-ui-size-lg)]',
  xl: 'text-[length:var(--type-ui-size-xl)]',
  '2xl': 'text-[length:var(--type-ui-size-2xl)]',
  '3xl': 'text-[length:var(--type-ui-size-3xl)]',
  '4xl': 'text-[length:var(--type-ui-size-4xl)]',
};

export function Display({
  as: Tag = 'h2',
  size = '2xl',
  balance = false,
  className,
  id,
  ref,
  tabIndex,
  children,
}: {
  /**
   * The heading level, and it is **required thinking** rather than a styling
   * choice — the default is `h2` because that is what a section heading is, and
   * a page's one `h1` should be spelled out at its call site.
   */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
  size?: DisplaySize;
  /** Tight leading and balanced wrapping, for a heading that runs to two lines. */
  balance?: boolean;
  className?: string;
  id?: string;
  /**
   * Forwarded, because moving focus to a heading is how a step change is
   * announced.
   *
   * The onboarding wizard swaps its content without navigating, so a screen
   * reader has nothing to announce and a keyboard user's focus is left on a
   * button that no longer relates to what is on screen. Focusing the new
   * heading fixes both — and it needs `tabIndex={-1}`, since a heading is not
   * focusable by default. Both props exist here for that one pattern.
   */
  ref?: Ref<HTMLElement>;
  tabIndex?: number;
  children: ReactNode;
}) {
  return (
    <Tag
      id={id}
      // The element type is chosen by the caller, so the ref cannot be narrowed
      // to one of them at the declaration. `HTMLElement` is what every branch
      // has in common and what the prop is honestly typed as.
      ref={ref as Ref<HTMLHeadingElement>}
      tabIndex={tabIndex}
      className={cx(
        'font-(family-name:--type-family-display) [font-stretch:125%]',
        SIZES[size],
        balance && (size === '4xl' ? 'leading-[0.98] text-balance' : 'leading-[1.05] text-balance'),
        className,
      )}
    >
      {children}
    </Tag>
  );
}
