import type { ReactNode } from 'react';

/**
 * Off-screen but still announced.
 *
 * Not `display:none` and not `visibility:hidden` — both remove the element from
 * the accessibility tree, which is the opposite of the intent. Tailwind's
 * `sr-only` is the 1px-clip form that survives every screen reader; this wraps
 * it so components state the intent rather than repeating the mechanism.
 */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
