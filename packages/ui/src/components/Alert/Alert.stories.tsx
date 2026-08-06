import { Alert } from './Alert';

import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * Four tones, and colour is never the only signal in any of them: each carries
 * a glyph and a **spoken prefix** in `sr-only` text.
 *
 * `prefixes` is a required prop with no default, which is the rule this library
 * arrived at the hard way - `SpecBand` composed its readout from English
 * literals and the German landing page announced the product's signature
 * element entirely in English. A component library cannot know the page's
 * language, so a default *is* a guess, and it ships.
 */
const PREFIXES = {
  info: 'Note',
  success: 'Success',
  warning: 'Warning',
  danger: 'Error',
};

const meta = {
  title: 'Feedback/Alert',
  component: Alert,
  args: { prefixes: PREFIXES, title: 'Export ready' },
  argTypes: {
    tone: { control: 'inline-radio', options: ['info', 'success', 'warning', 'danger'] },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No `role` unless asked. An informational note that steals focus from a live region is noise. */
export const Info: Story = {
  args: { tone: 'info', title: 'Nothing to show yet' },
};

export const Success: Story = {
  args: { tone: 'success', title: 'Your export is ready' },
};

export const Warning: Story = {
  args: { tone: 'warning', title: 'Energy density is drifting toward its lower limit' },
};

/**
 * The only tone that takes `role="alert"` - an assertive live region that
 * interrupts. The others are `status`, which waits for a pause. Using
 * `alert` for a success message is how a screen reader user gets cut off
 * mid-sentence to be told something worked.
 */
export const Danger: Story = {
  args: { tone: 'danger', title: 'We could not reach the server' },
};

export const WithBody: Story = {
  args: {
    tone: 'danger',
    title: 'We could not reach the server',
    children: <p>Your changes are still here. Try again in a moment.</p>,
  },
};

export const AllTones: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(['info', 'success', 'warning', 'danger'] as const).map((tone) => (
        <Alert key={tone} tone={tone} prefixes={PREFIXES} title={`${PREFIXES[tone]} tone`} />
      ))}
    </div>
  ),
};
