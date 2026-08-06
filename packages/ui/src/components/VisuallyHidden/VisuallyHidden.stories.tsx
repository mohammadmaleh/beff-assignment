import { VisuallyHidden } from './VisuallyHidden';

import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * Text for screen readers that is not painted.
 *
 * The one thing to know about it is what it is **not**: `display: none` and
 * `visibility: hidden` remove content from the accessibility tree as well as
 * from the page, and `aria-hidden` removes it from the tree while leaving it
 * on screen. This is the third case - present to assistive technology, absent
 * visually - and there is no shorthand for it that a browser ships.
 *
 * Every story below is deliberately blank-looking. Open the a11y panel, or
 * inspect the DOM, to see what is there.
 */
const meta = {
  title: 'Utilities/VisuallyHidden',
  component: VisuallyHidden,
  args: { children: 'Loading production data' },
} satisfies Meta<typeof VisuallyHidden>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/**
 * The pattern it exists for. `Button` uses exactly this: a spinner is
 * `aria-hidden` because it announces nothing, and the state has to be said in
 * words or a screen-reader user is told nothing happened.
 */
export const NamingAnIcon: Story = {
  render: () => (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true">✓</span>
      <VisuallyHidden>Success</VisuallyHidden>
      <span>Export ready</span>
    </span>
  ),
};

/**
 * The other half of the rule: the glyph is hidden and the *word* carries the
 * meaning, so the encoding survives greyscale, colour blindness and a printout.
 * Colour is never the only signal in this system.
 */
export const SupplementingColour: Story = {
  render: () => (
    <p className="text-status-danger-fg flex items-center gap-2">
      <span aria-hidden="true">▲</span>
      <VisuallyHidden>Out of spec:</VisuallyHidden>
      <span className="tabular-nums">37.8 % - above upper limit</span>
    </p>
  ),
};
