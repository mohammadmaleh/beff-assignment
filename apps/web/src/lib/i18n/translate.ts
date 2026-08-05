/**
 * A display name for a key the API returned.
 *
 * The API never sends display strings — it sends stable keys (`porosity_pct`,
 * `die_cutting`), because a display string cannot be translated by the client
 * and a German plant would otherwise read its own process steps in English.
 * Every one of those keys therefore meets the dictionary here.
 *
 * ## Why it is a function and not four inline lookups
 *
 * The pattern was written out at seven call sites as
 * `` (t.dashboard.steps as Record<string, string>)[key] ?? key ``, and the cast
 * is the tell. It exists only because a dictionary literal has a *specific*
 * object type, so indexing it with an arbitrary string is an error — and a cast
 * written seven times is seven places where the fallback can be dropped and a
 * new process step renders as blank rather than as its key.
 *
 * Taking `Readonly<Record<string, string>>` makes the cast unnecessary rather
 * than hiding it: the dictionary literal is assignable to it, and the parameter
 * type is what does the widening.
 *
 * The fallback is the key itself, deliberately. A step the dictionary has not
 * caught up with should render as `die_cutting` — visibly untranslated, and
 * still identifying the row — rather than as an empty cell that reads as a
 * rendering failure.
 */
export function translate(dictionary: Readonly<Record<string, string>>, key: string): string {
  return dictionary[key] ?? key;
}
