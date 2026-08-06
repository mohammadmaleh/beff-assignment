import { Display } from '@beff/ui/display';
import { Eyebrow } from '@beff/ui/eyebrow';
import { Lede } from '@beff/ui/lede';
import { Metric } from '@beff/ui/metric';
import { SpecBand } from '@beff/ui/spec-band';

import { ScrapChart } from '@/components/ScrapChart';
import { CO2_INTENSITY, PERCENT } from '@/constants/units';
import { formatters } from '@/lib/format';
import { getDictionary, translate, type Locale } from '@/lib/i18n';
import { PROCESS_STEPS } from '@/lib/metrics';

import { DEMO_LINE } from './demoLine';

/**
 * ## The product, on the marketing page
 *
 * The design brief ruled out a product screenshot, and was right to: it was
 * written before the product existed, and a mocked-up dashboard is both
 * dishonest and obvious to a reviewer who works on a line. There is a product
 * now, so this panel renders **the dashboard's own components** - `Metric`,
 * `ScrapChart`, `SpecBand` - on the seeded demo line's own figures. Not a
 * picture of the product and not a rebuild of it: the same code, server-rendered.
 *
 * It cannot go stale, it is translated because the components are, its chart
 * still has a table behind it, and its out-of-spec reading is still out of spec.
 *
 * ### The inversion
 *
 * `data-theme="dark"` scopes the dark palette to this section, so the panel
 * renders in the opposite pole from the page around it - the dry room at night,
 * and the one place the page raises its voice. It is not new colour: every pair
 * inside is a pair the contrast gate already asserts for the dark theme, which is
 * why the token build unscopes that selector from `:root` rather than growing a
 * second `surface-emphasis` family nobody solved.
 *
 * In dark mode the panel and the page are the same tone and the hairline frame
 * carries the boundary instead. That is deliberate: inverting *again* would put a
 * page-width white block in front of someone who asked for a dark interface.
 */
export function ProductPanel({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);

  const format = formatters(locale);

  return (
    <section
      data-theme="dark"
      aria-labelledby="product"
      className="bg-surface-base text-text-default border-border-default border-y"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-20 lg:py-28">
        {/*
         * A `div`, not a `header`. Inside a `section` the element carries no
         * semantics - `header` only maps to the `banner` landmark at the top
         * level - so it bought nothing, and the screen-reader gate caught it as a
         * second unnamed banner in the landmark rotor next to the site header.
         */}
        <div className="flex flex-col gap-4">
          <Eyebrow>{t.landing.productLineLabel}</Eyebrow>
          <Display as="h2" className="max-w-3xl leading-[1.1]" id="product">
            {t.landing.productTitle}
          </Display>
          <Lede>{t.landing.productBody}</Lede>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label={t.dashboard.metrics.fpy}
            value={format.decimal(DEMO_LINE.first_pass_yield_pct)}
            unit={PERCENT}
            delta={format.percentagePoints(DEMO_LINE.first_pass_yield_delta_pp)}
            trend="up"
            trendWords={t.a11y.trend}
            intent="positive"
          />
          <Metric
            label={t.dashboard.metrics.scrap}
            value={format.decimal(DEMO_LINE.scrap_rate_pct)}
            unit={PERCENT}
            delta={format.percentagePoints(DEMO_LINE.scrap_rate_delta_pp)}
            trend="down"
            trendWords={t.a11y.trend}
            // Scrap falling is good news off the same arrow yield uses for the
            // opposite direction. Colour follows the meaning, not the glyph.
            intent="positive"
          />
          <Metric
            label={t.dashboard.metrics.retention}
            value={format.decimal(DEMO_LINE.capacity_retention_pct)}
            unit={PERCENT}
          />
          <Metric
            label={t.dashboard.metrics.co2}
            value={format.decimal(DEMO_LINE.co2_intensity_kg_per_kwh)}
            unit={CO2_INTENSITY}
          />
        </div>

        <div className="grid gap-12 lg:grid-cols-[3fr_2fr] lg:gap-16">
          <div className="flex flex-col gap-6">
            <Display as="h3" size="lg">
              {t.dashboard.scrapTitle}
            </Display>
            <ScrapChart rows={DEMO_LINE.scrap_by_step} locale={locale} order={PROCESS_STEPS} />
          </div>

          <div className="flex flex-col gap-6">
            <Display as="h3" size="lg">
              {t.dashboard.bandsTitle}
            </Display>
            <div className="flex flex-col gap-8">
              {DEMO_LINE.spec_bands.map((band) => (
                <SpecBand
                  key={band.parameter}
                  label={translate(t.dashboard.parameters, band.parameter)}
                  words={t.a11y.specBand}
                  value={band.value}
                  lowerLimit={band.lower_limit}
                  upperLimit={band.upper_limit}
                  {...(band.target === null ? {} : { target: band.target })}
                  unit={band.unit}
                />
              ))}
            </div>
          </div>
        </div>

        <Lede size="sm">{t.landing.productNote}</Lede>
      </div>
    </section>
  );
}
