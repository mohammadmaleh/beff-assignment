import { Display } from '../Display/index';

import { Eyebrow } from './Eyebrow';

import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * The small letter-spaced label in the data face: a section kicker, a figure's
 * caption, a column header, the ordinal on a chain marker.
 *
 * `0.14em` is the one genuinely load-bearing value. Uppercase text at `xs`
 * without added tracking is measurably harder to read - the shapes that
 * distinguish lowercase letters are gone and the remaining rectangles run
 * together. A copy that lost the tracking would not look broken; it would just
 * be worse to read, which is the kind of regression no test catches.
 */
const meta = {
  title: 'Typography/Eyebrow',
  component: Eyebrow,
  args: { children: 'Production line' },
  argTypes: { as: { control: 'inline-radio', options: ['p', 'span', 'div'] } },
} satisfies Meta<typeof Eyebrow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/**
 * An eyebrow above a heading is **not** a heading. Marked up as one it puts a
 * two-word fragment into the document outline above the title it introduces,
 * and a screen-reader user navigating by heading lands on "PRODUCTION LINE"
 * instead of on the section. So it defaults to `<p>` and offers no heading tag.
 */
export const AboveAHeading: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Eyebrow>Production line</Eyebrow>
      <Display as="h2" balance>
        Pilot cell line 2, Stuttgart
      </Display>
    </div>
  ),
};

export const AsSpan: Story = { args: { as: 'span', children: '01' } };

/** With layout classes of the caller's own - the axis ends under a figure. */
export const AsAxisLabel: Story = {
  args: {
    as: 'div',
    className: 'flex justify-between',
    children: (
      <>
        <span>Mixing</span>
        <span>End-of-line test</span>
      </>
    ),
  },
};

/**
 * German again. `Elektrolytbefüllung` is one word, and uppercase plus tracking
 * makes it noticeably wider - the case that decides whether a label wraps.
 */
export const GermanLength: Story = {
  render: () => (
    <div className="flex max-w-xs flex-col gap-3">
      <Eyebrow>Electrolyte filling</Eyebrow>
      <Eyebrow>Elektrolytbefüllung</Eyebrow>
    </div>
  ),
};
