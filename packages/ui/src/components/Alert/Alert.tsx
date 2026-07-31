import type { ReactNode } from 'react';

import { cx } from '../../lib/cx/index.js';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  tone?: AlertTone;
  title: string;
  /**
   * Announce even when the tone would not normally warrant it. Needed when this
   * alert *replaces* a live region — an empty state arriving where a "loading…"
   * announcement just was leaves a screen reader user with silence otherwise.
   */
  announce?: boolean;
  children?: ReactNode;
  className?: string;
}

/**
 * Each tone carries a glyph and a word, not just a hue. Roughly one man in
 * twelve cannot separate the success green from the danger red, and *in spec*
 * versus *out of spec* is the most consequential distinction this product
 * makes.
 *
 * The glyph is `aria-hidden` because the prefix word beside it already conveys
 * the same thing to a screen reader; announcing both would read as noise.
 */
const TONES: Record<AlertTone, { class: string; glyph: string; prefix: string; live: boolean }> = {
  info: {
    class: 'border-border-default text-text-default',
    glyph: 'ℹ',
    prefix: 'Note',
    live: false,
  },
  success: {
    class: 'border-status-success-fg text-status-success-fg',
    glyph: '✓',
    prefix: 'Success',
    live: true,
  },
  warning: {
    class: 'border-status-warning-fg text-status-warning-fg',
    glyph: '▲',
    prefix: 'Warning',
    live: true,
  },
  danger: {
    class: 'border-status-danger-fg text-status-danger-fg',
    glyph: '✕',
    prefix: 'Error',
    live: true,
  },
};

export function Alert({ tone = 'info', title, announce = false, children, className }: AlertProps) {
  const spec = TONES[tone];

  return (
    <div
      // `alert` interrupts; `status` waits for a pause. Only a failure earns an
      // interruption.
      role={tone === 'danger' ? 'alert' : spec.live || announce ? 'status' : undefined}
      className={cx(
        'rounded-chamfer flex items-start gap-3 border p-4',
        // The design brief settled on no cards, so the left rule carries the
        // grouping a filled panel would otherwise carry.
        'border-s-4',
        spec.class,
        className,
      )}
    >
      <span aria-hidden="true" className="leading-none">
        {spec.glyph}
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium">
          <span className="sr-only">{spec.prefix}: </span>
          {title}
        </p>
        {children ? <div className="text-text-default">{children}</div> : null}
      </div>
    </div>
  );
}
