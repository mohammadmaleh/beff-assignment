import { Field } from './Field';

import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * The wiring behind `TextField`, exposed on its own because not every control
 * is an `<input>`.
 *
 * It takes a **render prop** rather than children, and that is the whole design:
 * the id, the `aria-describedby` list, `aria-invalid` and `required` are
 * computed here and handed to whatever control the caller is using. A `<select>`
 * or a custom widget gets the same label-and-error contract as a text input,
 * with no chance of the description being described and the error not.
 */
const meta = {
  title: 'Forms/Field',
  component: Field,
  args: { label: 'Line type' },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

const select = (
  props: Parameters<Parameters<typeof Field>[0]['children']>[0],
): React.ReactElement => (
  <select
    {...props}
    className="border-border-default rounded-chamfer bg-surface-base text-text-default focus:border-text-default border px-3 py-2 text-[length:var(--type-ui-size-sm)] outline-none"
    defaultValue="pilot"
  >
    <option value="pilot">Pilot line</option>
    <option value="production">Production line</option>
  </select>
);

export const WithSelect: Story = { args: { children: select } };

export const Required: Story = { args: { required: true, children: select } };

export const WithDescription: Story = {
  args: {
    description: 'Decides which specification window first-pass yield is judged against.',
    children: select,
  },
};

/**
 * The error comes **first** in `aria-describedby`, before the description.
 * Screen readers read the list in order, and a reader who has just failed
 * validation wants the problem before the hint they already read.
 */
export const WithError: Story = {
  args: {
    required: true,
    description: 'Decides which specification window applies.',
    error: 'Choose a line type.',
    children: select,
  },
};
