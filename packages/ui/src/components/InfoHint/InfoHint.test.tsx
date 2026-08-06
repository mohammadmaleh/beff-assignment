import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { InfoHint } from './InfoHint';

const setup = () =>
  render(<InfoHint label="About this section">Ordered by process step.</InfoHint>);

describe('InfoHint', () => {
  it('names its trigger, because an icon announces nothing', () => {
    setup();

    expect(screen.getByRole('button', { name: 'About this section' })).toBeInTheDocument();
  });

  it('describes the trigger whether or not the hint is on screen', () => {
    // The whole point of moving prose behind an icon is that sighted readers
    // stop paying for it. A screen reader must not pay either - the text stays
    // in the accessibility tree and stays *reachable* from the button, so the
    // reference can never dangle the way a mount-on-open tooltip's does.
    setup();

    const trigger = screen.getByRole('button', { name: 'About this section' });
    const describedBy = trigger.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();

    const hint = document.getElementById(describedBy as string);
    expect(hint).not.toBeNull();
    expect(hint).toHaveTextContent('Ordered by process step.');
  });

  it('shows the hint on hover and takes it away again', async () => {
    setup();
    const trigger = screen.getByRole('button', { name: 'About this section' });
    const hint = document.getElementById(trigger.getAttribute('aria-describedby') as string);

    expect(hint).toHaveClass('sr-only');

    await userEvent.hover(trigger);
    expect(hint).not.toHaveClass('sr-only');

    await userEvent.unhover(trigger);
    expect(hint).toHaveClass('sr-only');
  });

  it('shows the hint on keyboard focus, not only on hover', async () => {
    // WCAG 2.2 1.4.13. A hint reachable only with a pointer is a hint a
    // keyboard user does not have.
    setup();
    const trigger = screen.getByRole('button', { name: 'About this section' });
    const hint = document.getElementById(trigger.getAttribute('aria-describedby') as string);

    await userEvent.tab();
    expect(trigger).toHaveFocus();
    expect(hint).not.toHaveClass('sr-only');
  });

  it('dismisses on Escape without moving focus', async () => {
    // Also 1.4.13: content shown on hover or focus must be dismissible while
    // the pointer or focus stays where it is - an overlay a reader cannot get
    // out from under is worse than one that never opened.
    setup();
    const trigger = screen.getByRole('button', { name: 'About this section' });
    const hint = document.getElementById(trigger.getAttribute('aria-describedby') as string);

    await userEvent.tab();
    expect(hint).not.toHaveClass('sr-only');

    await userEvent.keyboard('{Escape}');
    expect(hint).toHaveClass('sr-only');
    expect(trigger).toHaveFocus();
  });

  it('stays open on any other key, so typing elsewhere does not close it', async () => {
    // The Escape listener is on the document while the hint is open, which is
    // what makes it dismissible for a mouse user whose focus is elsewhere. That
    // reach is also why it has to ignore every other key.
    setup();
    const trigger = screen.getByRole('button', { name: 'About this section' });
    const hint = document.getElementById(trigger.getAttribute('aria-describedby') as string);

    await userEvent.tab();
    await userEvent.keyboard('a');

    expect(hint).not.toHaveClass('sr-only');
  });

  it('toggles on click, so a touch reader can open it at all', async () => {
    // There is no hover on a touch screen and `focus` on tap is inconsistent
    // across mobile browsers. Click is the only interaction that is guaranteed.
    setup();
    const trigger = screen.getByRole('button', { name: 'About this section' });
    const hint = document.getElementById(trigger.getAttribute('aria-describedby') as string);

    await userEvent.click(trigger);
    expect(hint).not.toHaveClass('sr-only');

    await userEvent.click(trigger);
    expect(hint).toHaveClass('sr-only');
  });
});
