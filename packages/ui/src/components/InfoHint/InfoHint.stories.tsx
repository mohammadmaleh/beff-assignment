import { InfoHint } from './InfoHint';

import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * The alternative to a paragraph under every heading.
 *
 * A dashboard is read by people who already know what first-pass yield is.
 * Explaining it in prose beside the figure spends the most valuable space on
 * the page on the reader who needs it least — and the explanation still has to
 * exist, because the reader who *is* new arrives once and needs it badly. This
 * puts it a hover away and gives the rest of the width back to the data.
 *
 * The text is in the accessibility tree at all times, closed or open. See the
 * component docstring for why a mount-on-open tooltip would be worse than none.
 */
const meta = {
  title: 'Feedback/InfoHint',
  component: InfoHint,
  args: {
    label: 'About this section',
    children:
      'Ordered by process step. A cell lost at formation has absorbed every upstream cost, so late-stage losses are the expensive ones.',
  },
} satisfies Meta<typeof InfoHint>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Where it actually sits: at the end of a section heading, on the baseline. */
export const BesideAHeading: Story = {
  render: (args) => (
    <h2 className="text-text-default flex items-center gap-2 text-[length:var(--type-ui-size-lg)] font-medium">
      Where the scrap happened
      <InfoHint {...args} />
    </h2>
  ),
};

/** German runs about 30% longer, and the panel is sized by its content. */
export const German: Story = {
  args: {
    label: 'Über diesen Abschnitt',
    children:
      'Nach Prozessschritt geordnet. Eine bei der Formierung verlorene Zelle hat bereits alle vorgelagerten Kosten aufgenommen.',
  },
};
