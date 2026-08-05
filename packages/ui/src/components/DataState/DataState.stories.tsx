import { DataState } from './DataState';

import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * The project rule is that **every data surface ships loading, empty, error and
 * partial**. This is the component that makes that cheap enough to actually do,
 * and the reason it is one component rather than three inline ternaries is that
 * inline ternaries are where "empty" quietly stops existing.
 *
 * Note that `empty` is separate from `status`. A successful request that
 * returned nothing is not an error and must not be dressed as one — the fix is
 * usually seeding data, and a red panel sends the reader looking for an outage.
 */
const PREFIXES = { info: 'Note', success: 'Success', warning: 'Warning', danger: 'Error' };

const CONTENT = (
  <p className="text-text-default">Twelve process steps, 1 340 cells started this window.</p>
);

const meta = {
  title: 'Data/DataState',
  component: DataState,
  args: {
    status: 'ready',
    loadingLabel: 'Loading production data',
    emptyTitle: 'No batches in this window',
    emptyBody: <p>Widen the date range, or check that the line is reporting.</p>,
    errorTitle: 'We could not load production data',
    alertPrefixes: PREFIXES,
    children: CONTENT,
  },
} satisfies Meta<typeof DataState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

/**
 * Three bars rather than a spinner: the shape hints at what is arriving, which
 * a spinner cannot. The bars are `aria-hidden` and the announcement is a
 * `role="status"` live region carrying `loadingLabel` — a pulsing rectangle
 * says nothing to a screen reader.
 *
 * The pulse is `motion-safe:`, so a reader who asked for less motion gets a
 * static placeholder rather than a stopped one.
 */
export const Loading: Story = { args: { status: 'loading' } };

/** `role="alert"`, because a failed load is the one thing worth interrupting for. */
export const Error: Story = {
  args: {
    status: 'error',
    errorBody: <p>Your session is still valid. Try again in a moment.</p>,
  },
};

/** `role="status"` and the `info` tone. A successful request that returned nothing is not a fault. */
export const Empty: Story = { args: { empty: true } };

export const AllStates: Story = {
  render: (args) => (
    <div className="flex flex-col gap-8">
      {(['loading', 'error'] as const).map((status) => (
        <DataState key={status} {...args} status={status} />
      ))}
      <DataState {...args} status="ready" empty />
      <DataState {...args} status="ready" />
    </div>
  ),
};
