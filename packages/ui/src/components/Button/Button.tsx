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
 */
/**
 * The press.
 *
 * Every variant sits on a 2px plinth drawn with a **hard-edged** `box-shadow` —
 * no blur, no offset sideways. That is a bevel, not a drop shadow, so it does
 * not reintroduce the floating card the design brief rules out: the button is
 * not hovering above the page, it has a machined edge, the way a key on a
 * control panel does.
 *
 * On `:active` it travels exactly the height of its own plinth and the plinth is
 * removed, so the control lands flush with the surface. The previous version
 * moved 1px with nothing underneath it, which reads as a jitter rather than as
 * a press — there was no depth for it to travel through.
 *
 * Only `translate` is transitioned. The shadow is swapped instantly, because
 * animating `box-shadow` is a paint on every frame and the brief allows
 * `transform` and `opacity` only. `translate` is the independent property, not
 * the `transform` shorthand, so it composes with any positioning utility
 * instead of cancelling it.
 */
const PLINTH = 'shadow-[0_2px_0_0_var(--plinth)] active:translate-y-[2px] active:shadow-none';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-default text-text-on-brand border border-brand-edge [--plinth:var(--color-brand-edge)] hover:bg-brand-hover ' +
    PLINTH,
  secondary:
    'bg-surface-base text-text-default border border-border-strong [--plinth:var(--color-border-strong)] hover:bg-surface-raised ' +
    PLINTH,
  // No plinth. Ghost is the quiet variant — giving it an edge would make it a
  // third weight competing with secondary, which is the whole thing it exists
  // not to do.
  ghost:
    'bg-transparent text-text-default border border-transparent hover:bg-surface-raised active:translate-y-px',
  // Destructive actions are never the primary weight — the shape has to read as
  // a consequence, not as the happy path.
  danger:
    'bg-surface-base text-status-danger-fg border border-status-danger-fg [--plinth:var(--color-status-danger-fg)] hover:bg-status-danger-fg hover:text-surface-base ' +
    PLINTH,
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
      className={cx(
        'rounded-chamfer inline-flex items-center justify-center font-[family-name:var(--type-family-body)] font-medium',
        'transition-[background-color,border-color,translate,opacity] duration-(--motion-duration-fast) ease-(--motion-easing-standard)',
        // A disabled control has nothing to press into, so it keeps neither the
        // plinth nor the travel. Leaving them on invites a click that does
        // nothing but still feels like it worked.
        'disabled:shadow-none disabled:active:translate-y-0 aria-disabled:shadow-none aria-disabled:active:translate-y-0',
        'disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
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
