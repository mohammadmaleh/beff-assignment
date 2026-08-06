import Link from 'next/link';

import { Display } from '@beff/ui/display';
import { Lede } from '@beff/ui/lede';
import { VideoPlayer } from '@beff/ui/video-player';

import { getDictionary, type Locale } from '@/lib/i18n';
import { surfacePath } from '@/lib/navigation';

/** The film's master. Anything larger on screen is an upscale of these pixels. */
const FILM = { width: 640, height: 360 } as const;

/**
 * ## The hero
 *
 * A headline, the argument beneath it, and the company film beside it.
 *
 * ### What used to be here
 *
 * The tolerance band, at hero scale, showing one out-of-spec reading. The design
 * brief asked for the signature element first, and the band demonstrated the
 * product rather than describing it. It was replaced on request.
 *
 * The band has not left the page — the signature section further down still
 * shows the same instrument twice, in spec and past its upper limit — so the
 * page still makes the argument, just after the film rather than before it.
 *
 * ### The trade this makes, stated
 *
 * The master is **640×360**. The hero column is wider than that on any desktop
 * viewport, so the film is being upscaled roughly 2× at exactly the moment the
 * page makes its first claim. `max-w-[640px]` caps it, which keeps it sharp and
 * leaves the column wider than the video — the alternative is a soft image as
 * the first thing a visitor sees. A larger master is the real fix.
 *
 * It also does not autoplay, so the hero's right-hand column is a poster frame
 * until someone presses play. That is deliberate: 71 seconds of unasked audio
 * would be the page's largest contentful paint and a `prefers-reduced-motion`
 * failure in one move.
 */
export function LandingHero({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);

  return (
    <section className="calibration-ground border-border-default border-b">
      {/* 5:4, not 1:1 — the headline needs the wider column or it sets to four
          lines and shouts; the instrument reads fine at the narrower measure. */}
      <div className="mx-auto grid max-w-6xl items-stretch gap-16 px-6 pt-16 pb-20 lg:grid-cols-[5fr_4fr] lg:gap-20 lg:pt-24 lg:pb-28">
        <div className="flex flex-col items-start gap-6">
          <p className="text-text-muted font-(family-name:--type-family-data) text-[length:var(--type-ui-size-xs)] tracking-[0.18em] uppercase">
            {t.landing.eyebrow}
          </p>

          <Display as="h1" size="4xl" balance>
            {t.landing.headline}
          </Display>

          <Lede size="lg">{t.landing.subhead}</Lede>

          <div className="mt-2 flex flex-wrap items-center gap-6">
            <Link
              /*
               * The absolute path, matching the header's button exactly. Both
               * land on the same anchor, but a screen reader's link rotor
               * compares destinations as written — two entries both named
               * "Request access" going to `#waitlist` and `/en#waitlist` read
               * as two different places, and the reader cannot tell which is
               * which. Asserted in `screen-reader.spec.ts`.
               */
              href={`${surfacePath('landing', locale)}#waitlist`}
              className="bg-brand-default text-text-on-brand rounded-control hover:bg-brand-hover inline-flex min-h-12 items-center justify-center gap-2 px-6 py-3 font-medium transition-[background-color,translate] duration-(--motion-duration-fast) ease-(--motion-easing-standard) active:translate-y-px"
            >
              {t.landing.ctaPrimary}
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="#cost" className="underline underline-offset-4">
              {t.landing.ctaSecondary}
            </Link>
          </div>
        </div>

        {/*
         * A band between two rules, not a card. The brief's one structural risk
         * is that nothing in this product is boxed — borders carry what a filled
         * container would, and the band is the unit of composition.
         *
         * The rules bracket the full height of the hero (`items-stretch` above)
         * rather than hugging the reading, so the column reads as a panel the
         * instrument sits in instead of a block floating in the middle of it.
         */}
        <div className="border-border-default flex flex-col justify-center gap-6 border-y py-8 lg:py-10">
          <VideoPlayer
            src="/media/beff-intro.mp4"
            poster="/media/beff-intro-poster.png"
            label={t.landing.filmLabel}
            width={FILM.width}
            height={FILM.height}
            className="max-w-[640px]"
          />
          <Lede size="sm">{t.landing.heroReadingNote}</Lede>
        </div>
      </div>
    </section>
  );
}
