import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

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

/** The signature section's first band, serialised. Equal strings, equal geometry. */
async function bandGeometry(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const svg = document.querySelector('figure svg');
    return svg === null ? null : svg.innerHTML;
  });
}

test('the landing page still draws the tolerance band @a11y', async ({ page }) => {
  /*
   * The band used to be the hero, at full scale, and this pair of tests measured
   * it there. The film replaced it in the hero on request — the band did not
   * leave the page, it moved down into the signature section, which shows the
   * same instrument twice: one reading in spec and one past its upper limit.
   *
   * So this asserts what survived the move. Not "the hero has a chart", which is
   * no longer true, and not the mid-flight animation, which was never honestly
   * assertable once the drawing became an ECharts instance: the animation
   * belongs to a render loop the library schedules, so any sample time is a race
   * this suite would lose intermittently on a loaded CI box. The animation
   * opt-in is gated where it is exact and cannot flake — `SpecBand`'s test
   * asserts it reaches the option's `animation`.
   */
  await page.goto('/en');

  const bands = page.locator('figure svg');
  await expect(bands.first()).toBeAttached();
  // The marks: track, window, two limits, the target, the reading.
  expect(await bands.first().locator('path').count()).toBeGreaterThan(3);
});

test('reduced motion shows the band at its final state immediately @a11y', async ({ page }) => {
  /*
   * The regression test for a real defect, carried across two rewrites now
   * because the defect is about the reader and not about where the band sits.
   * The global reduced-motion block zeroed `animation-duration` but not
   * `animation-delay`, so each part waited out its stagger before appearing
   * instantly — the measurement was invisible for 480ms for exactly the people
   * who asked for less motion.
   *
   * ECharts is outside the cascade, so that block cannot help it at all now;
   * `useReducedMotion` reads the preference and `bandOption` switches the
   * animation off entirely. Which makes the assertion sharper than it was: with
   * no animation there is nothing to interpolate, so the geometry at 120ms —
   * inside every delay the old sequence had — must already equal the geometry
   * once everything has settled.
   *
   * Breaking this deliberately is what caught the band rendering entirely
   * dashed: ECharts draws `markLine` dashed unless told otherwise, and the SVG
   * this dumps on failure is the only place that was visible.
   */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en');

  /*
   * `attached`, not the default `visible`. The band's series is a host for the
   * marks and nothing else — one point, `lineStyle: { width: 0 }` — so the first
   * path ECharts emits is a zero-width stroke, which Playwright correctly
   * reports as not visible and then waits 30s for. What is being waited on here
   * is that the chart has rendered at all, and attachment is exactly that.
   */
  await page.locator('figure svg path').first().waitFor({ state: 'attached' });
  await page.waitForTimeout(120);
  const early = await bandGeometry(page);

  await page.waitForTimeout(1200);
  const settled = await bandGeometry(page);

  expect(early).not.toBeNull();
  expect(early).toBe(settled);
});
