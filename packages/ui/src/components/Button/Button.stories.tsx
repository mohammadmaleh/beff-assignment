import { Button } from './Button';

import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * The project rule is that every component ships **all** of its states —
 * default, hover, focus-visible, active, disabled, loading. Hover and active
 * you get by pointing at it; the rest are stories, because they are the ones
 * nobody thinks to check and the ones that break.
 */
const meta = {
  title: 'Controls/Button',
  component: Button,
  args: { children: 'Save changes' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };

/**
 * Bordered and text-only rather than a filled red plate. There is no
 * `status-danger-bg` token, and inventing one would mean a colour pair the
 * contrast gate has never solved — which is exactly how a palette nobody chose
 * gets blessed.
 */
export const Danger: Story = { args: { variant: 'danger', children: 'Delete account' } };

export const Small: Story = { args: { size: 'sm', children: 'Reset' } };

/**
 * `disabled` **and** `aria-disabled`, and the cursor is `not-allowed`.
 *
 * That last one is why the pointer-cursor rule in `base.css` sits inside
 * `@layer base`: unlayered it would outrank `disabled:cursor-not-allowed`,
 * which is a Tailwind utility, and a disabled button would claim to be
 * clickable. Worse than the bug it fixes.
 */
export const Disabled: Story = { args: { disabled: true } };

/**
 * `aria-busy`, a spinner that respects `prefers-reduced-motion` via
 * `motion-safe:`, and a visually hidden label — because a spinner alone
 * announces nothing, and the click handler is detached so a second press
 * cannot double-submit.
 */
export const Loading: Story = { args: { loading: true, loadingLabel: 'Saving…' } };

/** Every variant at both sizes, for comparing weight rather than reading one. */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(['sm', 'md'] as const).map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-3">
          {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
            <Button key={variant} variant={variant} size={size}>
              {variant}
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
};
