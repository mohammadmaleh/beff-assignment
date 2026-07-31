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
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-default text-text-on-brand border border-brand-default hover:bg-brand-hover hover:border-brand-hover active:translate-y-px',
  secondary:
    'bg-transparent text-text-default border border-border-default hover:bg-surface-raised active:translate-y-px',
  ghost:
    'bg-transparent text-text-default border border-transparent hover:bg-surface-raised active:translate-y-px',
  // Destructive actions are never the primary weight — the shape has to read as
  // a consequence, not as the happy path.
  danger:
    'bg-transparent text-status-danger-fg border border-status-danger-fg hover:bg-status-danger-fg hover:text-surface-base active:translate-y-px',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'text-[length:var(--type-ui-size-sm)] px-3 py-1.5 gap-1.5',
  md: 'text-[length:var(--type-ui-size-md)] px-4 py-2 gap-2',
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
        'transition-[background-color,border-color,transform,opacity] duration-(--motion-duration-fast) ease-(--motion-easing-standard)',
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
