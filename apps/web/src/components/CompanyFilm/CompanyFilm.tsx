import { Display } from '@beff/ui/display';
import { Eyebrow } from '@beff/ui/eyebrow';
import { Lede } from '@beff/ui/lede';

import { getDictionary, type Locale } from '@/lib/i18n';

/** The master. Anything larger on screen is an upscale of these pixels. */
const INTRINSIC = { width: 640, height: 360 } as const;

/**
 * Beff's own introduction film.
 *
 * ## Where this sits, and why
 *
 * Between the tolerance band and the waitlist. By that point the argument is
 * finished — problem, cost, product, signature — and the only question left
 * before someone hands over a work email is *who are you*. That is the one slot
 * a company film answers. It is deliberately not the hero: the hero already has
 * the spec band, and a 360p master behind it would be visibly soft at the exact
 * moment the page is making its first claim.
 *
 * ## What the asset forces
 *
 * The master is **640×360**. Stretched across a full-bleed band it is a 2.25×
 * upscale, so the width cap lives in this component rather than in whatever page
 * holds it — a caller cannot accidentally blow it up.
 *
 * **No autoplay.** 71 seconds with an audio track, 3.9 MB, unasked. It would be
 * the page's largest contentful paint and would fail `prefers-reduced-motion` in
 * the same move. `preload="metadata"` fetches the header and stops, so a visitor
 * who scrolls past pays for a few kilobytes rather than the whole film.
 *
 * Native `<video controls>` rather than a custom player: keyboard operation, the
 * scrubber, volume and every AT announcement arrive free.
 *
 * ## The gap, stated
 *
 * **This film has an audio track and ships without captions.** That is WCAG
 * 1.2.2 (A) and 1.2.5 (AA) unmet, on a surface that otherwise targets 2.2 AA. It
 * was a deliberate call, and the README records exactly where the claim no
 * longer holds rather than leaving a false one standing. The text beside the
 * video is not a substitute for captions — it is there so the section still
 * carries its meaning for anyone who cannot or will not play 71 seconds of
 * video, which is most readers.
 */
export function CompanyFilm({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);

  return (
    <section aria-labelledby="company-film" className="border-border-default scroll-mt-8 border-t">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <Eyebrow>{t.landing.filmEyebrow}</Eyebrow>

        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[2fr_3fr] lg:gap-16">
          <div className="flex flex-col gap-4">
            <Display as="h2" balance id="company-film">
              {t.landing.filmTitle}
            </Display>
            <Lede>{t.landing.filmBody}</Lede>
          </div>

          {/*
           * `border` and not a card: the page has no boxed containers, and the
           * hairline frame is the same one the product panel uses.
           */}
          {/*
           * `media-has-caption` is right, and this is a knowing exception, not
           * an oversight — see the class comment and the "Not done, and not
           * claimed" section of the README. Suppressed inline, at the one call
           * site, so it stays visible in review: turning the rule off in
           * `eslint.config.mjs` would silence the next uncaptioned video too,
           * and nobody would ever see it happen.
           *
           * Delete this line the moment a `.vtt` exists.
           */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- no transcript shipped with the film; tracked in README */}
          <video
            controls
            preload="metadata"
            poster="/media/beff-intro-poster.png"
            width={INTRINSIC.width}
            height={INTRINSIC.height}
            aria-label={t.landing.filmLabel}
            className="border-border-default h-auto w-full max-w-[640px] border"
          >
            <source src="/media/beff-intro.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  );
}
