import { cx } from '../../lib/cx/index';

export interface VideoPlayerProps {
  src: string;
  /** MIME type of `src`. Defaults to MP4, the only format this repo ships. */
  type?: string;
  /**
   * Poster frame. Strongly recommended: without one the element is a black
   * rectangle until the reader presses play, which on a hero is the largest
   * thing on the page saying nothing.
   *
   * `| undefined` explicitly, because `exactOptionalPropertyTypes` is on and a
   * caller resolving a poster from optional data passes the key with no value
   * rather than omitting it.
   */
  poster?: string | undefined;
  /**
   * The accessible name, in the page's own language.
   *
   * Required with no default, like every perceivable string in this library. A
   * `<video>` has no intrinsic name — an unlabelled one is announced as "video"
   * and nothing else — and an English default would ship silently onto the
   * German page, where nothing would catch it: axe is indifferent to which
   * language a well-formed string is in, and so is every screenshot.
   */
  label: string;
  /** The master's intrinsic size, so the box is reserved before metadata loads. */
  width: number;
  height: number;
  className?: string;
}

/**
 * A plain, accessible video element.
 *
 * ## Why native `<video controls>`
 *
 * Keyboard operation, the scrubber, volume, playback rate, picture-in-picture
 * and every assistive-technology announcement arrive free and correct. A custom
 * player re-implements all of that, and re-implements it worse — this is the
 * clearest case in the whole library of the project's "native HTML before ARIA"
 * rule, because here the native element is not merely sufficient, it is better.
 *
 * ## Why it never autoplays
 *
 * An unasked video with an audio track is the page's largest contentful paint
 * and a `prefers-reduced-motion` failure in the same move. `preload="metadata"`
 * fetches the header and stops, so a reader who scrolls past pays a few
 * kilobytes rather than the whole film.
 *
 * ## Captions
 *
 * This component takes no `<track>`, because nothing in this repo has a `.vtt`
 * yet. A video with an audio track and no captions is WCAG 1.2.2 (A) and 1.2.5
 * (AA) unmet — see the README's "Not done, and not claimed". The lint rule is
 * suppressed here, at one call site rather than in `eslint.config.mjs`, so the
 * exception stays visible in review instead of silently covering the next
 * uncaptioned video somebody adds.
 */
export function VideoPlayer({
  src,
  type = 'video/mp4',
  poster,
  label,
  width,
  height,
  className,
}: VideoPlayerProps) {
  return (
    /*
     * `media-has-caption` is right, and this is a knowing exception rather than
     * an oversight. Delete this line the moment a `.vtt` exists.
     */
    // eslint-disable-next-line jsx-a11y/media-has-caption -- no transcript shipped with the film; tracked in README
    <video
      controls
      preload="metadata"
      poster={poster}
      width={width}
      height={height}
      aria-label={label}
      className={cx('border-border-default h-auto w-full border', className)}
    >
      <source src={src} type={type} />
    </video>
  );
}
