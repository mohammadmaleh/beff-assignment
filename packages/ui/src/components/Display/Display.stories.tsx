import { Display } from './Display';

import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * The display face, and the reason it is a component rather than a class
 * constant: **`Archivo Expanded` is not a family**. It is `wdth: 125` on the
 * Archivo variable font, so the typeface only appears when the family and the
 * width axis are both set. Either one alone renders a heading that looks nearly
 * right and is not the brand's face - legible, plausible, wrong, and nothing
 * fails.
 *
 * It replaced 34 hand-written class strings in nine near-identical spellings.
 * Three of those differed only in `leading` and nobody could say which
 * difference was a decision.
 */
const meta = {
  title: 'Typography/Display',
  component: Display,
  args: { children: 'Know what a reading means' },
  argTypes: {
    as: { control: 'inline-radio', options: ['h1', 'h2', 'h3', 'h4', 'p', 'span'] },
    size: { control: 'inline-radio', options: ['lg', 'xl', '2xl', '3xl', '4xl'] },
  },
} satisfies Meta<typeof Display>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `h2` by default, because that is what a section heading is. A page's one `h1` is spelled out. */
export const SectionHeading: Story = {};

export const PageTitle: Story = { args: { as: 'h1', children: 'Production overview' } };

/**
 * Tight leading and `text-balance`, for a heading that runs to two or three
 * lines and where an orphaned last word is the whole visual problem. A
 * one-line title wants neither - `text-wrap: balance` on a line that does not
 * wrap is work done for nothing.
 */
export const BandHeading: Story = {
  args: { balance: true, children: 'Where the yield went, step by step' },
};

/**
 * The tightening scales with the size because it has to: at `4xl` the lines sit
 * close enough that 1.05 opens a visible gap, and at `2xl` 0.98 collides. That
 * relationship is exactly what a per-call-site class string could never hold on
 * to.
 */
export const Hero: Story = {
  args: { as: 'h1', size: '4xl', balance: true, children: 'A number is not an answer' },
};

export const Scale: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {(['lg', 'xl', '2xl', '3xl', '4xl'] as const).map((size) => (
        <Display key={size} as="p" size={size}>
          {size} · Calendering
        </Display>
      ))}
    </div>
  ),
};

/**
 * German runs roughly 30% longer than English and DE is a shipped locale, so
 * every heading wraps at a different point in the two. This is the pair to look
 * at when changing a size.
 */
export const GermanLength: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-8 sm:grid-cols-2">
      <Display as="p" balance>
        Where the yield went, step by step
      </Display>
      <Display as="p" balance>
        Wohin die Ausbeute verschwunden ist, Schritt für Schritt
      </Display>
    </div>
  ),
};
