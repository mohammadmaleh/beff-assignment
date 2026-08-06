import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx/index';
import { VisuallyHidden } from '../VisuallyHidden/index';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, blocks activation, and announces the wait. */
  loading?: boolean;
  /** Announced while `loading`. Defaults to a generic English string. */
  loadingLabel?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Every variant ships default, hover, focus-visible, active, disabled and
 * loading. A component that only has a default state is a mockup.
 *
 * Focus is not styled here: `:focus-visible` is handled once globally against
 * `--color-border-focus`, which the contrast gate proves clears 3:1 on both
 * surfaces. Restyling it per component is how a design system ends up with
 * seven different focus rings.
 *
 * ## Weight comes from fill, never from an outline.
 *
 * The previous revision drew every variant with a 1px border and a 2px bevel.
 * Both are gone. An outline around a filled button is a second edge describing
 * a boundary the fill already states, and a hard bevel is skeuomorphic — it
 * asks the control to imitate a physical key, which reads as dated rather than
 * as machined. What separates the variants now is how much ink each one
 * spends: solid brand, a tinted plate, or nothing at all.
 *
 * Contrast survives the change. `surface-sunken` rather than `surface-raised`
 * for the secondary plate: raised sits ~2% off the base surface and a
 * borderless button drawn on it would be invisible on the very page it lives
 * on. Sunken is the separation that was previously being done by the border.
 *
 * The press is `translate` alone — the independent property, not the
 * `transform` shorthand, which would cancel any positioning utility beside it.
 * One pixel, because there is no longer a plinth to travel through and a
 * larger movement without depth reads as a jitter.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-default text-text-on-brand hover:bg-brand-hover active:translate-y-px',
  secondary: 'bg-surface-sunken text-text-default hover:bg-surface-raised active:translate-y-px',
  // Ghost spends no ink at rest. It is the quiet variant, and giving it a
  // resting fill would make it a third weight competing with secondary.
  ghost: 'bg-transparent text-text-default hover:bg-surface-sunken active:translate-y-px',
  /*
   * Destructive actions are never the primary weight — the shape has to read as
   * a consequence, not as the happy path. So there is no resting plate at all:
   * the danger colour as text, with the solid fill held back until hover, when
   * the intent is already deliberate.
   *
   * That is also the only thing the palette allows. `status-danger-fg` in dark
   * clears 4.5:1 against `surface-base` and **nothing else** — the gate rejected
   * it on `sunken` and on `raised`. This variant may therefore only be used on
   * the base surface, which is where the Profile danger zone puts it (a left
   * rule, no background). Moving it onto a panel needs the token re-solved
   * first, not a `className` override.
   */
  danger:
    'bg-transparent text-status-danger-fg hover:bg-status-danger-fg hover:text-surface-base active:translate-y-px',
};

/*
 * Roomier than before. The old `px-4 py-2` at the body size produced a control
 * whose label nearly touched its own border, which is most of what made these
 * read as unstyled browser buttons. Horizontal padding is now roughly double
 * the vertical, the proportion a physical key has.
 */
const SIZES: Record<ButtonSize, string> = {
  sm: 'text-[length:var(--type-ui-size-sm)] px-4 py-2 gap-2 min-h-9',
  md: 'text-[length:var(--type-ui-size-md)] px-6 py-2.5 gap-2 min-h-11',
};

/**
 * The button's look, without the button.
 *
 * ## Why this is exported
 *
 * A call to action that *navigates* is a link. It has no `type`, no `disabled`
 * and no `onClick` contract, and it belongs in a screen reader's link rotor
 * rather than its button one — so `Button` must not render it, and `<Button
 * as="a">` would be the same mistake with a nicer spelling.
 *
 * That left the app hand-rolling this class string as an anchor in three
 * places, and they drifted exactly as copied strings do: the 404 page's copy
 * used `rounded-chamfer`, dropped the transition, the press and the minimum
 * height, and had been shipping a visibly different primary control from the
 * header's for as long as it existed.
 *
 * ## Why classes rather than a link slot
 *
 * `CookieBanner` takes its link as a `ReactNode` because it renders *around*
 * one. Here the caller renders the link and only needs it dressed, so handing
 * back the classes is the whole job — and it keeps this package router-free.
 * Importing `next/link` for one href would make the entire design system
 * Next-only.
 */
export interface ButtonClassNameOptions {
  /*
   * `| undefined` on every property, spelled out. `tsconfig.base` sets
   * `exactOptionalPropertyTypes`, under which `variant?: ButtonVariant` means
   * "may be absent" and **not** "may be `undefined`" — so `Button` forwarding
   * its own destructured props here would not typecheck. That distinction is
   * the whole point of the flag and it is right; an options bag being handed
   * values that are genuinely `undefined` is the case it is not for.
   */
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  className?: string | undefined;
}

export function buttonClassName({
  variant = 'primary',
  size = 'md',
  className,
}: ButtonClassNameOptions = {}): string {
  return cx(
    // `rounded-control`, not `rounded-chamfer`. 2px on a full-width band reads
    // as machined; the same 2px on a 44px control reads as a browser default
    // nobody styled.
    'rounded-control inline-flex items-center justify-center font-[family-name:var(--type-family-body)] font-medium',
    'transition-[background-color,color,translate,opacity] duration-(--motion-duration-fast) ease-(--motion-easing-standard)',
    // A dead control does not move. Travel on something that cannot be
    // activated makes a click that did nothing still feel like it worked.
    'disabled:active:translate-y-0 aria-disabled:active:translate-y-0',
    'disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel = 'Working…',
  disabled = false,
  type = 'button',
  children,
  className,
  onClick,
  ...rest
}: ButtonProps) {
  // A loading button must not be activatable, but `disabled` alone would drop
  // it out of the tab order mid-interaction and throw focus back to the
  // document — the user loses their place because the app got slow.
  // `aria-disabled` keeps it focusable and announced; withholding the handler
  // makes it inert.
  const inert = disabled || loading;

  return (
    <button
      type={type}
      disabled={disabled}
      aria-disabled={inert || undefined}
      aria-busy={loading || undefined}
      onClick={inert ? undefined : onClick}
      className={buttonClassName({ variant, size, className })}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner />
          <VisuallyHidden>{loadingLabel}</VisuallyHidden>
        </>
      ) : null}
      {children}
    </button>
  );
}

/**
 * `animate-spin` is a transform, and the global reduced-motion rule collapses
 * its duration, so a user who asked for no motion gets a static mark rather
 * than a spinning one.
 */
function Spinner() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      className="motion-safe:animate-spin"
    >
      <circle
        cx="7"
        cy="7"
        r="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.3"
      />
      <path
        d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
