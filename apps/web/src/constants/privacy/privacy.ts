/**
 * The version of the privacy text the consent banner is asking about.
 *
 * Bump it whenever `datenschutz/content.ts` changes in a way that alters what
 * is being consented to. The banner stores it alongside the decision and
 * re-opens when the two disagree, because consent to an old text is not consent
 * to a new one — treating it as such is what makes a consent record worthless
 * as evidence, which is the whole reason the record exists.
 *
 * A date rather than a counter: it has to be checkable against the document's
 * own "last updated" line by a human reading both.
 */
export const PRIVACY_POLICY_VERSION = '2026-07-31';
