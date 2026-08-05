import { SpecBand } from './SpecBand';

import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * The product's signature element: a reading drawn against the window it is
 * judged by.
 *
 * ## `words` is required and has no default
 *
 * The drawing is `aria-hidden`, so the composed readout is the component's
 * **entire** accessible content. It once assembled that readout from English
 * literals, and the German landing page announced this element — the signature
 * one — wholly in English inside a `lang="de"` document. Nothing caught it: axe
 * is indifferent to which language a well-formed string is in, and so is every
 * screenshot and the contrast gate. Hence the rule the whole library now
 * follows: every perceivable string is a required prop with no default.
 *
 * ## Animation is not here
 *
 * The `band-draw` keyframes live in the consuming app, not in this package. A
 * component that animates on mount animates *everywhere* it is placed —
 * including twelve at a time on the dashboard. `SpecBand` exposes `data-part`
 * hooks and the page decides.
 */
const WORDS = {
  inSpec: 'in spec',
  aboveUpper: 'above upper limit',
  belowLower: 'below lower limit',
  specification: 'Specification',
  target: 'target',
};

const meta = {
  title: 'Data/SpecBand',
  component: SpecBand,
  args: {
    label: 'Electrode porosity',
    words: WORDS,
    value: 32.4,
    lowerLimit: 28,
    upperLimit: 36,
    target: 32,
    unit: '%',
  },
} satisfies Meta<typeof SpecBand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InSpec: Story = {};

/**
 * Out of spec is a **position** first — the tick sits outside the shaded range
 * — with the colour as a second encoding and the words "above upper limit" as
 * a third. It survives greyscale, colour blindness and a printout.
 */
export const AboveUpperLimit: Story = { args: { value: 37.8 } };

export const BelowLowerLimit: Story = { args: { value: 26.1 } };

/** A window with no target. The centre mark simply is not drawn. */
export const NoTarget: Story = {
  args: { label: 'Areal loading', value: 21.4, lowerLimit: 19, upperLimit: 23, unit: 'mg/cm²' },
};

/**
 * The reading sits far outside the window. The plotted domain defaults to the
 * spec window padded by half its width, so an out-of-spec value stays visible
 * rather than being clipped to the edge — a tick pinned to the frame reads as
 * "at the limit", which would be a lie.
 */
export const WellOutOfSpec: Story = {
  args: { label: 'Energy density', value: 198, lowerLimit: 240, upperLimit: 270, unit: 'Wh/kg' },
};

/**
 * The same instrument at presentation size: the label becomes an eyebrow, the
 * reading is set at readout scale, and the domain is labelled at its ends so
 * the axis is readable rather than implied. One component, two sizes — the
 * signature element must not exist twice, or the two copies drift.
 */
export const Hero: Story = {
  args: {
    scale: 'hero',
    label: 'First-pass yield',
    value: 78.4,
    lowerLimit: 85,
    upperLimit: 97,
    target: 92,
    unit: '%',
    precision: 1,
  },
};

export const Stack: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-10">
      <SpecBand
        label="Electrode porosity"
        words={WORDS}
        value={32.4}
        lowerLimit={28}
        upperLimit={36}
        target={32}
        unit="%"
      />
      <SpecBand
        label="Areal loading"
        words={WORDS}
        value={21.4}
        lowerLimit={19}
        upperLimit={23}
        unit="mg/cm²"
      />
      <SpecBand
        label="Energy density"
        words={WORDS}
        value={238}
        lowerLimit={240}
        upperLimit={270}
        target={255}
        unit="Wh/kg"
      />
    </div>
  ),
};
