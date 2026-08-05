import { TextField } from './TextField';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Forms/TextField',
  component: TextField,
  args: { label: 'Work email', type: 'email', placeholder: 'you@company.de' },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: {
    description: 'We only use this to send your export when it is ready.',
  },
};

/**
 * The marker is `<span aria-hidden>*</span>` **inside** the `<label>`, so the
 * visible text is `Work email *` while the accessible name stays `Work email` —
 * aria-hidden nodes are skipped in name computation. The two disagree by
 * design, and that is worth knowing before writing a test: an anchored
 * `getByLabelText('Work email')` matches, an exact-string query on the visible
 * text does not.
 */
export const Required: Story = { args: { required: true } };

/**
 * `aria-invalid`, an `id`-linked `role="alert"` message, and a glyph beside the
 * text so the error is not carried by red alone.
 */
export const WithError: Story = {
  args: { required: true, defaultValue: 'not-an-email', error: 'Enter a valid email address.' },
};

export const Disabled: Story = { args: { disabled: true, defaultValue: 'you@company.de' } };

/** Every state at once, which is how you notice one of them is missing. */
export const AllStates: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-6">
      <TextField label="Default" placeholder="Empty" />
      <TextField label="Filled" defaultValue="you@company.de" />
      <TextField label="Required" required />
      <TextField label="Described" description="A hint that sits under the label." />
      <TextField label="Errored" error="Enter a valid email address." defaultValue="nope" />
      <TextField label="Disabled" disabled defaultValue="Locked" />
    </div>
  ),
};
