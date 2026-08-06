import { ThemeScript } from './ThemeScript';

import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * Applies the stored theme **before first paint**, and renders nothing you can
 * see - the story below shows the script tag it emits, because that is the
 * whole component.
 *
 * ## Why it has to be a blocking inline script
 *
 * Anything that runs after hydration - a `useEffect`, a client provider -
 * paints the default theme first, so a reader who chose dark gets a white flash
 * on every navigation. It belongs in `<head>`, above the app.
 *
 * The token sheet keys off `[data-theme]`, and its
 * `:root:not([data-theme="light"])` media block already handles the
 * no-preference case, so this script only ever has to write an *explicit*
 * choice.
 *
 * ## Why `localStorage` and not a cookie
 *
 * It is a UI preference, it is never sent to the server, and a cookie would
 * drag it into the consent banner for no reason - see `CookieBanner`, which is
 * about the things that genuinely need consent.
 *
 * ## Why the key is a prop
 *
 * This script and `ThemeToggle` are two halves of one contract that never see
 * each other: one runs before React exists, the other inside it. The app owns
 * the key - and namespaces it, since `localStorage` is per *origin* rather than
 * per app.
 */
const meta = {
  title: 'Utilities/ThemeScript',
  component: ThemeScript,
  args: { storageKey: 'beff-theme' },
} satisfies Meta<typeof ThemeScript>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The emitted script, shown as text. In the real app this renders into `<head>`
 * and is invisible; here it is the only thing worth looking at.
 */
export const EmittedScript: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <ThemeScript {...args} />
      <pre className="border-border-default bg-surface-sunken overflow-x-auto border p-4 font-(family-name:--type-family-data) text-[length:var(--type-ui-size-xs)]">
        {`try{var t=localStorage.getItem(${JSON.stringify(args.storageKey)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`}
      </pre>
      <p className="text-text-muted text-[length:var(--type-ui-size-sm)]">
        Wrapped in <code>try/catch</code>: reading <code>localStorage</code> throws outright in a
        browser with site data blocked, and an exception in a blocking head script would take the
        page with it.
      </p>
    </div>
  ),
};

/**
 * The key reaches the script body as a **string literal**, so it is quoted with
 * `JSON.stringify` rather than interpolated. A key containing a quote would
 * otherwise close the literal and the script would stop parsing - the one place
 * in this package where a prop reaches something evaluated as code.
 */
export const AKeyThatWouldBreakInterpolation: Story = {
  args: { storageKey: 'weird"key' },
  render: (args) => (
    <pre className="border-border-default bg-surface-sunken overflow-x-auto border p-4 font-(family-name:--type-family-data) text-[length:var(--type-ui-size-xs)]">
      {`localStorage.getItem(${JSON.stringify(args.storageKey)})`}
    </pre>
  ),
};
