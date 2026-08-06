import { notFound } from 'next/navigation';

/**
 * Catches any path under a locale that no real route claims, so the segment's
 * own `not-found.tsx` renders instead of Next's built-in 404.
 *
 * This is needed because a segment `not-found.tsx` only fires on an explicit
 * `notFound()` call from inside that segment - an unmatched URL otherwise falls
 * through to the *root* not-found, which this app has no layout for. Without
 * this file, `/en/no-such-page` renders an unstyled default page with no header,
 * no footer and no way back.
 *
 * `dynamicParams` stays default here: these paths are unknowable at build time,
 * which is the entire point.
 */
export default function Unmatched(): never {
  notFound();
}
