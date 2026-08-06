import { Metric } from './Metric';

import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * A figure with a direction of travel - and **not** a figure against a limit.
 * That is `SpecBand`, and the distinction is the product's whole thesis: 71.8%
 * reads as a crisis on a production line and as a good week on a pilot line,
 * and a tile cannot tell you which.
 *
 * Use this where there is genuinely no specification window: scrap rate (the
 * inverse of yield, which no plant specifies separately), CO₂ intensity, a
 * count. Banding those would look consistent and be a lie.
 */
const TREND_WORDS = { up: 'up', down: 'down', flat: 'unchanged' };

const meta = {
  title: 'Data/Metric',
  component: Metric,
  args: { label: 'Total scrap rate', value: '4.2', unit: '%' },
} satisfies Meta<typeof Metric>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No delta, no arrow. A reading with no comparison should not imply one. */
export const Plain: Story = {
  args: { label: 'CO₂ intensity', value: '62.4', unit: 'kg CO₂e/kWh' },
};

/**
 * The arrow is `▲` **and** the word "up" in `sr-only` text, because a glyph
 * announces nothing. `trend` and `trendWords` are a union in the type: you
 * cannot pass one without the other.
 */
export const Rising: Story = {
  args: { delta: '+1.4 pp', trend: 'up', trendWords: TREND_WORDS, intent: 'negative' },
};

/**
 * Falling scrap is **good** news off the same arrow rising yield uses for the
 * opposite direction, so `intent` is the caller's judgement and never derived
 * from the sign. Colour follows the meaning, not the glyph.
 */
export const FallingIsGood: Story = {
  args: { delta: '-0.6 pp', trend: 'down', trendWords: TREND_WORDS, intent: 'positive' },
};

/** `-`, and the word "unchanged". Not an arrow pointing anywhere. */
export const Flat: Story = {
  args: { delta: '0.0 pp', trend: 'flat', trendWords: TREND_WORDS },
};

export const Row: Story = {
  render: () => (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      <Metric
        label="First-pass yield"
        value="71.8"
        unit="%"
        delta="+1.4 pp"
        trend="up"
        trendWords={TREND_WORDS}
        intent="positive"
      />
      <Metric
        label="Total scrap rate"
        value="4.2"
        unit="%"
        delta="-0.6 pp"
        trend="down"
        trendWords={TREND_WORDS}
        intent="positive"
      />
      <Metric label="Capacity retention" value="92.1" unit="%" />
      <Metric label="CO₂ intensity" value="62.4" unit="kg CO₂e/kWh" />
    </div>
  ),
};
