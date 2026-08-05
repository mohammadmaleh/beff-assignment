'use client';

import { useEffect, useState } from 'react';

import { REDUCED_MOTION_QUERY } from '../media/index';

/**
 * Whether the reader has asked for less motion.
 *
 * CSS handles this for everything the app draws itself, via the
 * `@media (prefers-reduced-motion: reduce)` block in `globals.css`. A canvas or
 * SVG animated by JavaScript is outside the cascade's reach entirely — ECharts
 * runs its own render loop and will happily tween a path for 400ms regardless
 * of what any stylesheet says. So the preference has to be read and passed in.
 *
 * Defaults to `false` on the server, then corrects in an effect. The other
 * direction would be worse in a specific way: defaulting to `true` means a
 * reader who did not ask for reduced motion gets the animation switched *on*
 * mid-render, which is itself an unexpected movement.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    setReduced(query.matches);

    const follow = (event: MediaQueryListEvent): void => {
      setReduced(event.matches);
    };
    query.addEventListener('change', follow);
    return () => {
      query.removeEventListener('change', follow);
    };
  }, []);

  return reduced;
}
