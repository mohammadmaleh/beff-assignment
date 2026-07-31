import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { THEME_STORAGE_KEY } from '@/components/ThemeScript';

import { ThemeToggle } from './ThemeToggle';

/*
 * `window.localStorage`, never the bare global. Node 22 ships its own
 * experimental `localStorage` on `globalThis`, and it wins over jsdom's — the
 * bare form fails with "localStorage.clear is not a function" in a test that
 * works perfectly in a browser.
 */
describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('is a native select, so it needs no ARIA to be operable', () => {
    render(<ThemeToggle locale="en" />);
    expect(screen.getByRole('combobox', { name: /appearance/i }).tagName).toBe('SELECT');
  });

  it('defaults to following the system', () => {
    render(<ThemeToggle locale="en" />);
    expect(screen.getByRole('combobox')).toHaveValue('system');
  });

  it('pins the theme and remembers the choice', async () => {
    render(<ThemeToggle locale="en" />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('hands control back to the media query when set to system', async () => {
    // Removing the attribute, not setting it to "light" — otherwise "system"
    // would silently mean "light" for a user whose OS is dark.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<ThemeToggle locale="en" />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'system');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('reads the stored choice after mount', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<ThemeToggle locale="en" />);
    expect(screen.getByRole('combobox')).toHaveValue('light');
  });

  it('is labelled in German in the German locale', () => {
    render(<ThemeToggle locale="de" />);
    expect(screen.getByRole('combobox', { name: /darstellung/i })).toBeInTheDocument();
  });
});
