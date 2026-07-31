/**
 * Join class names, dropping anything falsy.
 *
 * Deliberately not `clsx`: this is the whole of what the component library
 * needs, and a dependency in a design system is a dependency in every app that
 * consumes it.
 */
export const cx = (...parts: readonly (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');
