import Link from 'next/link';

import { Display } from '@beff/ui/display';
import { Lede } from '@beff/ui/lede';
import { SpecBand } from '@beff/ui/spec-band';

import { getDictionary, type Locale } from '@/lib/i18n';
import { surfacePath } from '@/lib/navigation';

/**
 * The plotted domain for the hero reading.
 *
 * A production line specifies 85–97 per cent first-pass yield (CONTEXT.md), so
 * 60 to 100 is the axis it would be judged on: wide enough that the reading and
 * the specification window are both legible in proportion, and wide enough that
 * an out-of-spec reading stays on the track rather than clamped to the edge — the
 * component's default padding would put it there.
 */
const YIELD_DOMAIN = [60, 100] as const;

/**
 * ## The hero
 *
 * The design brief's first instruction: the signature element at full scale,
 * showing one honest reading — not a screenshot of a product, and not a headline
 * with two buttons and empty space where the argument should be.
 *
 * The reading is a production line at 78.4 per cent against a specification of
 * 85 to 97. It is out of spec, and the band says so three ways: by position, by
 * becoming a filled diamond instead of a hairline, and in words. The first thing
 * the page does is demonstrate the thing the product does.
 *
 * `data-band-draw` opts this one band into the page's single orchestrated
 * moment — the range draws, the limits appear, the reading settles. See
 * `globals.css`; under `prefers-reduced-motion` it collapses to final state.
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
        <div
          data-band-draw
          className="border-border-default flex flex-col justify-center gap-6 border-y py-8 lg:py-10"
        >
          <SpecBand
            scale="hero"
            label={t.landing.heroReadingLabel}
            words={t.a11y.specBand}
            value={78.4}
            lowerLimit={85}
            upperLimit={97}
            target={92}
            unit="%"
            domain={YIELD_DOMAIN}
          />
          <Lede size="sm">{t.landing.heroReadingNote}</Lede>
        </div>
      </div>
    </section>
  );
}
