import { expect, test } from '@playwright/test';

/**
 * The landing surface in a real browser.
 *
 * These duplicate very little of the unit suite on purpose — what is worth
 * checking here is what only a browser can answer: that the statically
 * generated HTML is what actually arrives, that the locale redirect works, and
 * that the page does not reach a third party.
 */

test('the root redirects to a locale', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/(en|de)$/);
});

test('the German page is German before any JavaScript runs', async ({ page }) => {
  // `page.goto` with JS disabled would be stronger still, but this at least
  // asserts against the served document rather than the hydrated one.
  const response = await page.goto('/de');
  const html = (await response?.text()) ?? '';

  expect(html).toContain('Ausschuss erkennen');
  expect(html).toContain('lang="de"');
});

test('the page has exactly one h1 and a main landmark', async ({ page }) => {
  await page.goto('/en');

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByRole('main')).toBeVisible();
});

test('the tolerance band states its verdict in words', async ({ page }) => {
  await page.goto('/en');

  // The signature element's accessibility story: a screen-reader user gets the
  // conclusion, not a description of a drawing.
  await expect(page.getByText(/out of spec, above the upper limit/).first()).toBeVisible();
});

test('nothing is fetched from Google', async ({ page }) => {
  // LG München I, 3 O 17493/20 — embedding Google Fonts transmits the visitor's
  // IP and was found to violate GDPR. The token pipeline self-hosts, and this
  // is the check that the built page agrees.
  const thirdParty: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) thirdParty.push(request.url());
  });

  await page.goto('/en');
  await page.waitForLoadState('networkidle');

  expect(thirdParty).toEqual([]);
});

test('both legal pages are linked from the footer', async ({ page }) => {
  // §5 DDG wants the imprint "easily recognisable and directly reachable".
  await page.goto('/en');

  await expect(page.getByRole('link', { name: 'Imprint' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy policy' }).first()).toBeVisible();
});

test('an unknown path renders the not-found page', async ({ page }) => {
  const response = await page.goto('/en/no-such-page');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'That page is not here' })).toBeVisible();
});
