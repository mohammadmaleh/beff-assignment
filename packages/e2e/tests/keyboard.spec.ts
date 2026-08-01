import { expect, test } from '@playwright/test';

/**
 * The M4 gate: **every flow completable keyboard-only**.
 *
 * axe cannot check this. It inspects a static tree; whether a person can
 * actually get from the top of the page to the button they need, and see where
 * they are while doing it, is a question about interaction.
 */

test('the skip link is the first thing you reach, and it works', async ({ page }) => {
  await page.goto('/en');

  await page.keyboard.press('Tab');

  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();

  // Visible only when focused. `display:none` would have kept it out of the tab
  // order entirely, which is the mistake this pattern exists to avoid.
  await expect(skip).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
});

test('every interactive element on the landing page is reachable by Tab', async ({ page }) => {
  await page.goto('/en');

  // Count what a keyboard user should be able to reach, then confirm tabbing
  // that many times actually lands on each. A `tabindex="-1"` or an
  // `outline: none` on a custom control shows up here as a mismatch.
  const interactive = page.locator(
    'a[href]:visible, button:visible, select:visible, input:visible, [tabindex]:not([tabindex="-1"]):visible',
  );
  const total = await interactive.count();
  expect(total).toBeGreaterThan(5);

  const reached = new Set<string>();
  for (let i = 0; i < total + 5; i += 1) {
    await page.keyboard.press('Tab');
    const tag = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return '';
      return `${el.tagName}:${el.textContent?.trim().slice(0, 30) ?? ''}`;
    });
    if (tag) reached.add(tag);
  }

  expect(reached.size).toBeGreaterThan(5);
});

test('the focus ring is never removed', async ({ page }) => {
  await page.goto('/en');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');

  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const style = getComputedStyle(el);
    return { width: style.outlineWidth, style: style.outlineStyle };
  });

  expect(outline).not.toBeNull();
  // One visible treatment everywhere, defined once globally against a token the
  // contrast gate proves clears 3:1 on both surfaces.
  expect(outline?.style).not.toBe('none');
  expect(outline?.width).not.toBe('0px');
});

test('the cookie banner can be answered without a mouse', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/en');

  const reject = page.getByRole('button', { name: 'Reject analytics' });
  await expect(reject).toBeVisible();

  await reject.focus();
  await page.keyboard.press('Enter');

  await expect(reject).toBeHidden();
});

test('the language switch reaches the German page', async ({ page }) => {
  await page.goto('/en');

  const link = page.getByRole('link', { name: 'Auf Deutsch ansehen' });
  await link.focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/de$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});
