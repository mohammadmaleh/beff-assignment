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
  { path: '/en/product', name: 'product (EN)' },
  { path: '/de/product', name: 'product (DE)' },
  { path: '/en/technology', name: 'technology (EN)' },
  { path: '/de/technology', name: 'technology (DE)' },
  { path: '/en/about', name: 'about (EN)' },
  { path: '/de/about', name: 'about (DE)' },
  { path: '/en/impressum', name: 'imprint' },
  { path: '/de/datenschutz', name: 'privacy policy' },
  // Both locales for the legal documents that are genuinely translated. The
  // storage and processing tables are the densest markup on the site and the
  // German column headings are the longest, so DE is where a table breaks first.
  { path: '/en/agb', name: 'terms (EN)' },
  { path: '/de/agb', name: 'terms (DE)' },
  { path: '/en/barrierefreiheit', name: 'accessibility statement (EN)' },
  { path: '/de/barrierefreiheit', name: 'accessibility statement (DE)' },
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

test('the inverted product panel has no contrast violations @a11y', async ({ page }) => {
  // The panel renders the *dark* palette inside a light page, so its pairs are
  // never composed on this surface in either of the two theme passes above. That
  // is the point of scoping `data-theme` to a subtree rather than adding an
  // emphasis colour family — but "already gated in isolation" is a claim about
  // tokens, and this is the claim about the page.
  await page.goto('/en');

  const panel = page.getByRole('region', { name: 'The view at 08:40' });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-theme', 'dark');

  const results = await new AxeBuilder({ page })
    .withTags(TAGS)
    .include('[data-theme="dark"]')
    .analyze();

  expect(results.violations).toEqual([]);
});

test('the hero band draws itself, once @a11y', async ({ page }) => {
  // The design brief allows exactly one orchestrated moment. If the keyframes
  // stop applying, nothing breaks and nothing fails — the page just quietly
  // loses the thing it was designed around, which is why this is asserted.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/en');

  const midDraw = await page.evaluate(() => {
    const range = document.querySelector('[data-band-draw] [data-part="range"]');
    return range === null ? null : getComputedStyle(range).scale;
  });

  // Mid-flight: partially drawn along x, untouched along y.
  expect(midDraw).toMatch(/^0\.\d+ 1$/);
});

test('reduced motion collapses the band to its final state, delays included @a11y', async ({
  page,
}) => {
  /*
   * The regression test for a real defect. The global reduced-motion block
   * zeroed `animation-duration` but not `animation-delay`, so each part still
   * waited out its stagger before appearing instantly — the hero's measurement
   * was invisible for 480ms for exactly the people who asked for less motion.
   *
   * Measured at 120ms after load, which is inside every delay in the sequence.
   */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en');
  await page.waitForTimeout(120);

  const state = await page.evaluate(() =>
    ['range', 'limit', 'tick'].map((part) => {
      const node = document.querySelector(`[data-band-draw] [data-part="${part}"]`);
      return { part, opacity: node === null ? null : getComputedStyle(node).opacity };
    }),
  );

  expect(state).toEqual([
    { part: 'range', opacity: '1' },
    { part: 'limit', opacity: '1' },
    { part: 'tick', opacity: '1' },
  ]);
});
