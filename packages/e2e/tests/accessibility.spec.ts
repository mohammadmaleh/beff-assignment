import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * The automated half of the accessibility gate.
 *
 * axe finds roughly 30–50% of WCAG issues. That is the reason this file exists
 * and also the reason it is not sufficient: passing here is a floor, not a
 * claim, and the README says so. The manual screen-reader pass is the other
 * half and has not happened.
 *
 * Every surface that renders without the API is covered. The authenticated
 * screens need the stack up and are not in this suite.
 */
const SURFACES = [
  { path: '/en', name: 'landing (EN)' },
  { path: '/de', name: 'landing (DE)' },
  { path: '/en/impressum', name: 'imprint' },
  { path: '/de/datenschutz', name: 'privacy policy' },
  { path: '/en/login', name: 'login' },
  { path: '/en/register', name: 'register' },
];

/**
 * WCAG 2.2 AA and nothing looser.
 *
 * `best-practice` is deliberately excluded: it mixes genuine failures with
 * stylistic opinions, and a gate that fires on opinion is a gate people learn
 * to override.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const surface of SURFACES) {
  test(`${surface.name} has no automatically detectable violations @a11y`, async ({ page }) => {
    await page.goto(surface.path);

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

    // The full violation list, not just a count — a failure should name the
    // rule and the element rather than making someone re-run locally to find
    // out what broke.
    expect(
      results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => node.target.join(' ')),
      })),
    ).toEqual([]);
  });
}

test('the cookie banner is reachable and has no violations @a11y', async ({ page }) => {
  // The banner only renders when no choice is stored, so it is invisible to a
  // plain page scan on any run where a previous test accepted it.
  await page.context().clearCookies();
  await page.goto('/en');

  const banner = page.getByRole('region', { name: 'Cookies' });
  await expect(banner).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(TAGS).include('body').analyze();
  expect(results.violations).toEqual([]);
});

test('dark mode has no contrast violations @a11y', async ({ page }) => {
  // Contrast is the one rule axe checks that depends on rendered colour, so the
  // dark theme genuinely needs its own pass — the token gate proves the pairs
  // in isolation, this proves what the page actually composed.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/en');

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  expect(results.violations).toEqual([]);
});
