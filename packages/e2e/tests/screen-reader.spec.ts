import { expect, test, type Page } from '@playwright/test';

/**
 * ## The screen-reader pass, as an executable gate
 *
 * `accessibility.spec.ts` runs axe. axe reads a static tree and checks rules
 * that can be decided from markup alone, which is why it catches 30–50% of
 * WCAG issues and no more. This file covers a different question: **what does a
 * screen reader actually say, in what order, and is it the truth?**
 *
 * It is driven by Chromium's own accessibility tree — the same computed roles
 * and accessible names that Chromium hands to UIA, IA2 and ATK, and therefore
 * the same text NVDA, JAWS and Orca read out. That is not a substitute for
 * listening to a real screen reader, and the README does not claim it is. What
 * it does is pin the findings of the manual pass so they cannot silently come
 * back.
 *
 * Every assertion here was written against a real finding. The one that
 * mattered: the German landing page announced its signature element entirely in
 * English.
 */

const TAG = '@a11y';

/** Surfaces that render without the API. Same scope as the rest of the suite. */
const EN_SURFACES = [
  '/en',
  '/en/product',
  '/en/technology',
  '/en/about',
  '/en/impressum',
  '/en/datenschutz',
  '/en/agb',
  '/en/barrierefreiheit',
  '/en/login',
  '/en/register',
];
const DE_SURFACES = [
  '/de',
  '/de/product',
  '/de/technology',
  '/de/about',
  '/de/impressum',
  '/de/datenschutz',
  '/de/agb',
  '/de/barrierefreiheit',
  '/de/login',
  '/de/register',
];

interface Announced {
  text: string;
  /** The `lang` in force at that node, resolved up the ancestor chain. */
  lang: string;
}

/**
 * Everything a screen reader would voice, with the language it is voiced in.
 *
 * `aria-hidden` subtrees are excluded because AT never reaches them, and
 * visually-hidden text is *included* because AT reaches it exactly like any
 * other text — that asymmetry is the whole point of collecting it this way
 * rather than reading `innerText`.
 */
async function announcedText(page: Page): Promise<Announced[]> {
  return page.evaluate(() => {
    const out: { text: string; lang: string }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    let node = walker.nextNode();
    while (node !== null) {
      const text = node.textContent?.trim() ?? '';
      const parent = node.parentElement;
      if (text !== '' && parent !== null) {
        const tag = parent.tagName;
        const hidden = parent.closest('[aria-hidden="true"], script, style, template') !== null;
        if (!hidden && tag !== 'SCRIPT' && tag !== 'STYLE') {
          out.push({ text, lang: parent.closest('[lang]')?.getAttribute('lang') ?? '' });
        }
      }
      node = walker.nextNode();
    }
    return out;
  });
}

/**
 * English wording that lives in `packages/ui` and would therefore be spoken on
 * a German page unless the caller supplies its own.
 *
 * These are not guesses. Each was found in the accessibility tree of `/de`
 * during the manual pass, or is a sibling string in the same component that
 * would have leaked the same way the moment that state rendered — a failed
 * request, an empty panel, a metric with a delta. The list is the regression
 * test for a class of bug, not for one instance of it.
 */
const ENGLISH_ONLY = [
  // SpecBand — the signature element, on the landing page in both locales.
  'in spec',
  'out of spec',
  'above the upper limit',
  'below the lower limit',
  'Specification ',
  ', target ',
  // Alert — the visually-hidden prefix that tells a screen reader the tone.
  'Error:',
  'Warning:',
  'Success:',
  'Note:',
  // DataState — the fallbacks for empty and failed panels.
  'Nothing to show yet',
  'That did not load',
  // Metric — the visually-hidden word carrying the trend direction.
  'unchanged',
];

for (const path of DE_SURFACES) {
  test(`${path} is announced in German, not English ${TAG}`, async ({ page }) => {
    await page.goto(path);

    const offences = (await announcedText(page))
      // Text explicitly marked as another language is correct, not a defect —
      // the locale switch link is `lang="en"` on the German page precisely so a
      // German voice does not read "View in English" phonetically. WCAG 3.1.2
      // asks for the marking, and this honours it.
      .filter((entry) => entry.lang === '' || entry.lang.startsWith('de'))
      .flatMap((entry) =>
        ENGLISH_ONLY.filter((phrase) => entry.text.includes(phrase)).map((phrase) => ({
          phrase,
          spokenAs: entry.text.slice(0, 120),
        })),
      );

    // WCAG 3.1.2 Language of Parts (AA). Beyond the letter of it: a German
    // synthesiser reads "in spec" with German phonetics, and the result is not
    // "in spec" with an accent — it is unintelligible.
    expect(offences).toEqual([]);
  });
}

test(`the spec band states its verdict in the page's own language ${TAG}`, async ({ page }) => {
  // The positive half of the rule above. A component that rendered *nothing*
  // would also pass a "no English" check, so assert the German is present, and
  // assert both verdicts — the landing page shows one reading inside the
  // window and one outside it.
  //
  // Matched by content rather than by position. The landing page grew a second
  // kind of figure and a panel of readings, so `first()` and `nth(1)` asserted
  // against whichever band happened to be highest in the document — a test that
  // fails when the page is rearranged says nothing about the language it is in.
  await page.goto('/de');

  const de = page.getByRole('figure');
  await expect(de.filter({ hasText: 'in der Spezifikation' }).first()).toBeVisible();
  await expect(de.filter({ hasText: 'außerhalb der Spezifikation' }).first()).toBeVisible();

  await page.goto('/en');
  const en = page.getByRole('figure');
  // "out of spec" does not contain "in spec", so these two select disjoint sets.
  await expect(en.filter({ hasText: 'in spec' }).first()).toBeVisible();
  await expect(en.filter({ hasText: 'out of spec' }).first()).toBeVisible();
});

for (const path of [...EN_SURFACES, ...DE_SURFACES]) {
  test(`${path} has a heading outline you can navigate by ${TAG}`, async ({ page }) => {
    await page.goto(path);

    const headings = await page.evaluate(() =>
      Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .filter((el) => el.closest('[aria-hidden="true"]') === null)
        .map((el) => ({
          level: Number(el.tagName[1]),
          text: (el.textContent ?? '').trim(),
        })),
    );

    // Jumping to the first heading is how a screen reader user skips the
    // furniture. Two h1s means there are two "the page is about this", and
    // none means there is no entry point at all.
    expect(headings.filter((h) => h.level === 1)).toHaveLength(1);

    // An empty heading is a rotor entry that announces nothing — worse than no
    // heading, because it occupies a position in the list.
    expect(headings.filter((h) => h.text === '')).toEqual([]);

    // A skipped level tells a screen reader user that content is missing.
    const skips = headings
      .slice(1)
      .map((heading, i) => ({ from: headings[i]!.level, to: heading.level }))
      .filter((step) => step.to > step.from + 1);
    expect(skips).toEqual([]);
  });
}

for (const path of ['/en', '/de']) {
  test(`${path} has landmarks that can be told apart ${TAG}`, async ({ page }) => {
    await page.goto(path);

    const landmarks = await page.evaluate(() => {
      const roleOf = (el: Element): string => {
        const explicit = el.getAttribute('role');
        if (explicit !== null) return explicit;
        return (
          { HEADER: 'banner', FOOTER: 'contentinfo', NAV: 'navigation', MAIN: 'main' }[
            el.tagName
          ] ?? 'region'
        );
      };
      return Array.from(document.querySelectorAll('header, footer, nav, main, section[aria-label]'))
        .filter((el) => el.closest('[aria-hidden="true"]') === null)
        .map((el) => ({
          role: roleOf(el),
          name:
            el.getAttribute('aria-label') ??
            document
              .getElementById(el.getAttribute('aria-labelledby') ?? '')
              ?.textContent?.trim() ??
            '',
        }));
    });

    expect(landmarks.filter((l) => l.role === 'main')).toHaveLength(1);

    // The landmark rotor lists these by role and name. Two unnamed navigations
    // read as "navigation, navigation" and the user has to enter both to find
    // out which is which.
    const duplicates = Object.entries(
      landmarks.reduce<Record<string, string[]>>((acc, landmark) => {
        (acc[landmark.role] ??= []).push(landmark.name);
        return acc;
      }, {}),
    ).filter(([, names]) => names.length > 1 && new Set(names).size !== names.length);

    expect(duplicates).toEqual([]);
  });
}

for (const path of [...EN_SURFACES, ...DE_SURFACES]) {
  test(`${path} names every control it offers ${TAG}`, async ({ page }) => {
    await page.goto(path);

    /*
     * The accessible name, computed by Playwright's implementation of the
     * accname spec — the string AT actually receives.
     *
     * This used to be hand-rolled as `aria-label ?? textContent`, which is not
     * accname and quietly disagreed with it. A link whose only content is an
     * `<img alt>` has a perfectly good name and no text content at all, so the
     * approximation reported the site's home link as unnamed the moment the
     * wordmark became an image — a false failure on a page that was correct.
     * The inverse is the dangerous direction: `textContent` also happily returns
     * text from an `aria-hidden` child that no screen reader will ever read, and
     * would have blessed a genuinely unnamed control.
     *
     * `ariaSnapshot()` on a single element yields that element on its first line
     * as `- role "name":`, with the name absent when there is none.
     */
    const elements = await page
      .locator('a[href]:visible, button:visible, input:visible, select:visible')
      .all();

    const controls = await Promise.all(
      elements.map(async (element) => {
        const [firstLine = ''] = (await element.ariaSnapshot()).split('\n');
        return {
          tag: await element.evaluate((el) => el.tagName),
          name: /^\s*-\s+\S+\s+"([^"]*)"/.exec(firstLine)?.[1]?.trim() ?? '',
          href: await element.getAttribute('href'),
        };
      }),
    );

    expect(controls.length).toBeGreaterThan(0);
    expect(controls.filter((c) => c.name === '')).toEqual([]);

    // "Read more" ×6 in the rotor's link list is a list of six identical
    // entries. The name has to make sense read out of context, because that is
    // how it gets read.
    const vague = ['read more', 'more', 'click here', 'here', 'learn more', 'link', 'button'];
    expect(controls.filter((c) => vague.includes(c.name.toLowerCase()))).toEqual([]);

    // Same name, different destination: the user cannot tell from the rotor
    // which one they are activating.
    const byName = controls
      .filter((c) => c.tag === 'A')
      .reduce<Record<string, Set<string>>>((acc, link) => {
        (acc[link.name] ??= new Set()).add(link.href ?? '');
        return acc;
      }, {});
    expect(Object.entries(byName).filter(([, hrefs]) => hrefs.size > 1)).toEqual([]);
  });
}

for (const path of ['/en/login', '/en/register', '/de/login', '/de/register']) {
  test(`${path} announces each field's label, requirement and purpose ${TAG}`, async ({ page }) => {
    await page.goto(path);

    const fields = await page.locator('form input').evaluateAll((elements) =>
      elements.map((el) => {
        const input = el as HTMLInputElement;
        return {
          name: input.name,
          label: document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim() ?? '',
          required: input.required || input.getAttribute('aria-required') === 'true',
          autocomplete: input.getAttribute('autocomplete'),
        };
      }),
    );

    expect(fields.length).toBeGreaterThan(1);
    for (const field of fields) {
      // A placeholder is not a label: it vanishes on first keystroke, and a
      // screen reader user who tabs back has nothing left to hear.
      expect(field.label, `${field.name} has no <label for>`).not.toBe('');
      // Announced as "required", not inferred from a red asterisk the user
      // cannot see. The asterisk in `Field` is `aria-hidden` for this reason.
      expect(field.required, `${field.name} is not programmatically required`).toBe(true);
      // WCAG 1.3.5 Identify Input Purpose (AA).
      expect(field.autocomplete, `${field.name} has no autocomplete purpose`).not.toBeNull();
    }
  });
}
