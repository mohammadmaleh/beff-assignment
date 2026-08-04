import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import type { Locale } from '@/lib/i18n';

/**
 * One numbered clause of a legal document, as data.
 *
 * Documents are data rather than JSX because they change on a legal review
 * cycle, not a product one — the same reason `PRIVACY_CONTENT` is a table. It
 * also means a translation can be diffed against its source clause by clause,
 * which is the only way anyone catches a German paragraph that quietly says
 * something the English one does not.
 */
export interface LegalClause {
  /** Stable anchor. Referred to from outside, so it must not track the heading. */
  id: string;
  heading: string;
  paragraphs: readonly string[];
}

export type LegalDocument = readonly LegalClause[];

/**
 * The chrome every legal document shares.
 *
 * Four documents — Impressum, Datenschutzerklärung, AGB, Barrierefreiheits-
 * erklärung — had four copies of the same header/measure/heading/footer. That is
 * how they drift: one gets a `scroll-mt` for deep links and the others do not,
 * and nobody notices until a link lands under the header.
 *
 * The typographic decisions here are the *prose* ones from the design brief, not
 * the app's. A dense data system and a readable legal document are different
 * problems and one does not fall out of the other:
 *
 * - **A measure.** `max-w-3xl` lands around 65–70 characters at the prose size.
 *   The dashboard is full-bleed; prose at that width is unreadable.
 * - **The prose scale** — larger size and looser leading than any app UI text.
 * - **`hyphens: auto` with a correct `lang`.** German compounds
 *   (*Datenschutz-Grundverordnung*, *Verantwortlicher für die Datenverarbeitung*)
 *   overflow a narrow measure, and CSS hyphenation only engages when the
 *   language is declared. `overflow-wrap` is the backstop for the ones that
 *   still do not break.
 *
 * `lang` is a required prop rather than being read from the page's locale,
 * because the two genuinely differ: the Impressum's body is German on the
 * English page. §5 DDG content is German or it is not the disclosure, and
 * announcing it with an English voice is WCAG 3.1.2 — the same defect class as
 * the `SpecBand` readout, in the opposite direction.
 */
export function LegalShell({
  locale,
  title,
  note,
  lang,
  children,
}: {
  locale: Locale;
  title: string;
  /** The short line under the H1 saying what statute the document answers to. */
  note: string;
  /** The language the *body* is written in. Not always the page locale. */
  lang: Locale;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader locale={locale} />
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] [font-stretch:125%]">
          {title}
        </h1>
        <p className="text-text-muted mt-4 text-[length:var(--type-ui-size-sm)]">{note}</p>

        <div
          lang={lang}
          className="mt-10 flex flex-col gap-10 text-[length:var(--type-prose-size-md)] leading-(--type-prose-leading) [overflow-wrap:break-word] [hyphens:auto]"
        >
          {children}
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

/**
 * One numbered section of a legal document.
 *
 * The ordinal is real here in the way the landing page's process markers are
 * real: GDPR articles and contract clauses have an order the reader follows and
 * refers back to ("under section 4 you agreed…"). `scroll-mt` so a deep link
 * does not land the heading underneath anything.
 */
export function LegalSection({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="font-medium">{heading}</h2>
      <div className="mt-2 flex flex-col gap-3">{children}</div>
    </section>
  );
}
