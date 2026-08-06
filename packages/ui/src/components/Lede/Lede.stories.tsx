import { Lede } from './Lede';

import type { Meta, StoryObj } from '@storybook/react-vite';

const BODY =
  'A cell manufacturer knows its first-pass yield. What it does not know is whether ' +
  '71.8% is a good week or a process that has been drifting for a month, and those two ' +
  'facts lead to different decisions.';

/**
 * Body copy at a readable measure.
 *
 * `max-w-[var(--type-prose-measure)]` is the class a paste drops silently. A
 * paragraph that loses it does not look broken - it looks *wider*, which reads
 * as fine on the laptop it was written on and becomes a 140-character line on a
 * 1440px screen, where the eye loses its place returning to the start of the
 * next line. The measure is a legibility constraint, not a layout preference,
 * so it belongs to the component rather than to whoever remembers it.
 */
const meta = {
  title: 'Typography/Lede',
  component: Lede,
  args: { children: BODY },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } },
} satisfies Meta<typeof Lede>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The reading size. Carries `--type-prose-leading`, because a longer line needs it to track. */
export const Reading: Story = {};

export const Opening: Story = { args: { size: 'lg' } };

/**
 * The supporting note - a figure description, a caption, a hint under a
 * control. Deliberately on the *UI* leading rather than the prose leading: at
 * this length two lines on prose leading read as two paragraphs.
 */
export const SupportingNote: Story = {
  args: {
    size: 'sm',
    children: 'Batch by batch, against the specification window and the cohort.',
  },
};

export const AsListItem: Story = {
  render: () => (
    <ul className="flex flex-col gap-4">
      {['Sixty batches per window', 'Twelve process steps', 'Two comparable cohorts'].map(
        (line) => (
          <Lede key={line} as="li" size="sm" className="border-border-default border-t pt-4">
            {line}
          </Lede>
        ),
      )}
    </ul>
  ),
};

export const Scale: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {(['lg', 'md', 'sm'] as const).map((size) => (
        <Lede key={size} size={size}>
          {size} · {BODY}
        </Lede>
      ))}
    </div>
  ),
};
