import { ThemeToggle } from './ThemeToggle';

import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';

/**
 * Unpinned, so each story starts from the ambient preference rather than from
 * whatever the previous story pressed.
 *
 * Named and typed rather than inline: an inline decorator makes `meta`'s
 * inferred type reference storybook's internal `csf` module, which TypeScript
 * cannot name in the declaration it emits (TS2742) — and it reports that
 * against the meta, not against the decorator responsible.
 */
const unpinTheme: Decorator = (Story) => {
  window.localStorage.removeItem('storybook-theme');
  return <Story />;
};

/**
 * A two-state theme control.
 *
 * ## Why there is no "system" option
 *
 * Offering one asked the reader to pick a default they already had. The page
 * reads `prefers-color-scheme` and follows it — including when it changes
 * mid-session, which is what an OS on a sunset schedule does — and stops only
 * once the reader overrides it. That is exactly what the three-option select
 * did, minus the option explaining it.
 *
 * ## Why a `<button>`
 *
 * Two mutually exclusive states with an obvious next step is a toggle, and a
 * native button carries keyboard operation, focus and an accessible name with
 * no ARIA at all. The name is the **action** ("Switch to dark appearance"), so
 * a screen-reader user hears what pressing it does rather than a setting whose
 * effect they must infer — and because the glyph is `aria-hidden`, that name is
 * the button's entire accessible content. Hence a required prop with no
 * default.
 *
 * ## Storybook note
 *
 * Pressing it writes `data-theme` on `<html>` and pins the choice in
 * `localStorage`, so it **overrides the toolbar's theme control** for the rest
 * of the session. That is the real behaviour, not a story artefact — the whole
 * point is that an explicit choice outranks the ambient one. Reload the frame
 * to hand control back to the toolbar.
 */
const meta = {
  title: 'Controls/ThemeToggle',
  component: ThemeToggle,
  args: {
    labels: { toDark: 'Switch to dark appearance', toLight: 'Switch to light appearance' },
    storageKey: 'storybook-theme',
  },
  decorators: [unpinTheme],
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The glyph shows the theme you would move *to*, not the one you are in. */
export const Default: Story = {};

export const German: Story = {
  args: {
    labels: {
      toDark: 'Zu dunkler Darstellung wechseln',
      toLight: 'Zu heller Darstellung wechseln',
    },
  },
};

/**
 * In the header it sits beside a nav and a wordmark, which is the constraint
 * that shaped it: the header is four items wide at 320px, and "Appearance" plus
 * a select ate a third of that to say what the icon says in twenty pixels.
 */
export const InAHeaderRow: Story = {
  render: (args) => (
    <div className="border-border-default flex items-center gap-4 border-b pb-4">
      <span className="font-(family-name:--type-family-display) [font-stretch:125%]">Beff</span>
      <span className="text-text-muted flex-1 text-[length:var(--type-ui-size-sm)]">
        Product · Technology · About
      </span>
      <ThemeToggle {...args} />
    </div>
  ),
};
