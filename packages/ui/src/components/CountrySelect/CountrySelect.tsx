'use client';

import { useCombobox } from 'downshift';
import { useMemo, useState } from 'react';

/*
 * The flags, as CSS classes over SVG files - imported here rather than by the
 * app, so a consumer cannot mount this component and get 250 empty boxes.
 *
 * Next collects a client component's CSS into the chunks for the routes that
 * use it, so the ~28 KB of `.fi-xx` rules never reach the marketing pages; the
 * flags themselves are ordinary images, and only the handful actually painted
 * are ever fetched. Vitest does not process CSS at all, so this costs the test
 * suite nothing.
 */
import 'flag-icons/css/flag-icons.min.css';

import { cx } from '../../lib/cx/index';
import { Field, type FieldProps } from '../Field/index';
import { VisuallyHidden } from '../VisuallyHidden/index';

import { matchCountries, type CountryOption } from './matching';

export type { CountryOption };

/**
 * Every string this component can utter.
 *
 * Required, with no defaults, because the design system cannot know the page's
 * language and a default **is** a guess that ships. That is not hypothetical
 * here: two of these five strings are announced only to screen readers, where a
 * wrong-language default is invisible to axe, to screenshots and to the
 * contrast gate - all three are indifferent to which language a well-formed
 * string is in.
 */
export interface CountrySelectCopy {
  /** Placeholder for the search box. Never a substitute for the label. */
  placeholder: string;
  /** Shown in place of the list, and announced, when nothing matches. */
  noResults: string;
  /** Accessible name of the open/close button. */
  toggleLabel: string;
  /** Live-region template. `{count}` is replaced with the number of matches. */
  resultsAnnouncement: string;
  /** Live-region template. `{country}` is replaced with the chosen name. */
  selectionAnnouncement: string;
}

export interface CountrySelectProps extends Omit<FieldProps, 'children'> {
  /**
   * Every country on offer, **already localised and already sorted** by the
   * caller. Sorting here would mean applying one collation to every language,
   * and `Ö` sorts with `O` in German but after `Z` in Swedish.
   */
  countries: readonly CountryOption[];
  /** ISO 3166-1 alpha-2. Case-insensitive, because the API folds case too. */
  value?: string | undefined;
  /** Receives the alpha-2 code - never the name. */
  onChange: (code: string) => void;
  copy: CountrySelectCopy;
}

const nameOf = (country: CountryOption | null): string => country?.name ?? '';

/**
 * A country picker you can type into.
 *
 * ## Why this is not a `<select>`
 *
 * Native HTML before ARIA is the standing rule here, and it loses this one
 * argument. A `<select>` of 250 options does have type-ahead, but it matches
 * from the *start* of the option text only - so `land` never finds
 * `Deutschland`, `oe` never finds `Österreich`, and prefixing each option with
 * a flag (which a `<select>` cannot render as an image anyway) would break even
 * that. The ARIA 1.2 combobox is the pattern that fits, so the compromise is to
 * not hand-roll it: `downshift` supplies the roles, the `aria-activedescendant`
 * bookkeeping and the whole key map, which is exactly where hand-rolled
 * comboboxes fail.
 *
 * ## One widget, one tab stop
 *
 * The toggle button is `tabindex="-1"`, per the APG pattern: everything it does
 * is already on the keyboard from the input, and a second stop only makes the
 * form longer to traverse.
 *
 * ## The flag is decoration
 *
 * It is `aria-hidden`, with the name and the ISO code as text beside it. Colour
 * and image are never the only signal here, and the flag carries no information
 * the row does not already state in words.
 */
export function CountrySelect({
  countries,
  value,
  onChange,
  copy,
  label,
  description,
  error,
  required,
}: CountrySelectProps) {
  const selected = useMemo(
    () => countries.find((country) => country.code === value?.toUpperCase()) ?? null,
    [countries, value],
  );

  /*
   * The query is *not* the input value.
   *
   * After a choice the box holds `Deutschland` verbatim; filtering by that
   * would offer exactly one country - the one already chosen - so changing
   * your mind would mean clearing the field first. Only typing narrows the
   * list, so every other producer of an input-value change (selection, blur
   * restoration, Escape) resets it to nothing.
   */
  const [query, setQuery] = useState('');
  const matches = useMemo(() => matchCountries(countries, query), [countries, query]);

  const {
    isOpen,
    highlightedIndex,
    getInputProps,
    getMenuProps,
    getItemProps,
    getToggleButtonProps,
  } = useCombobox<CountryOption>({
    items: matches,
    itemToString: nameOf,
    itemToKey: (country) => country?.code,
    selectedItem: selected,
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem) onChange(selectedItem.code);
    },
    onInputValueChange: ({ inputValue, type }) => {
      setQuery(type === useCombobox.stateChangeTypes.InputChange ? inputValue : '');
    },
    stateReducer: (state, { type, changes }) => {
      if (type !== useCombobox.stateChangeTypes.InputBlur) return changes;
      /*
       * Leaving the field with `franz` in the box and Germany selected would
       * read as France and submit DE. The visible answer and the real one are
       * the same thing, or the control is lying.
       */
      const after = changes.selectedItem === undefined ? state.selectedItem : changes.selectedItem;
      return { ...changes, inputValue: nameOf(after) };
    },
  });

  return (
    <Field
      label={label}
      {...(description === undefined ? {} : { description })}
      {...(error === undefined ? {} : { error })}
      {...(required === undefined ? {} : { required })}
    >
      {(control, meta) => (
        <div className="relative">
          <div
            className={cx(
              'border-border-default bg-surface-base rounded-chamfer flex items-center gap-2 border ps-3 pe-1',
              'focus-within:outline-border-strong focus-within:outline-2 focus-within:outline-offset-2',
              control['aria-invalid'] ? 'border-status-danger-fg border-2' : null,
            )}
          >
            <Flag code={selected?.code} />
            <input
              {...getInputProps({
                id: control.id,
                /*
                 * downshift points this at a label element it expects you to
                 * render from `getLabelProps`. `Field` renders the label, so
                 * that id belongs to nothing - and a dangling `aria-labelledby`
                 * is not a weaker name, it is silently no name at all, with the
                 * `<label for>` underneath it happening to save the day.
                 */
                'aria-labelledby': meta.labelId,
                'aria-describedby': control['aria-describedby'],
                'aria-invalid': control['aria-invalid'],
                required: control.required,
                placeholder: copy.placeholder,
                /*
                 * Not `country`. The browser's own autofill list paints over
                 * the listbox and takes the arrow keys with it - the one native
                 * behaviour a combobox cannot share a field with.
                 */
                autoComplete: 'off',
                /*
                 * `outline-none!`, and the `!` is load-bearing.
                 *
                 * `base.css` gives everything one focus ring from an
                 * **unlayered** `:focus-visible` rule, which outranks every
                 * Tailwind utility regardless of specificity - so the plain
                 * utility loses and the input draws a second ring *inside* the
                 * one on the box. The gap between the two edges then reads as a
                 * border between the field and its chevron: two controls where
                 * there is one. The ring is not removed, it is moved outwards
                 * to the wrapper, which is the thing a user would call "the
                 * field" - and `:focus-within` catches exactly the same moments
                 * for a text input as `:focus-visible` does.
                 */
                className:
                  'text-text-default placeholder:text-text-muted min-w-0 flex-1 bg-transparent py-2 outline-none!',
              })}
            />
            <button
              type="button"
              {...getToggleButtonProps({
                'aria-label': copy.toggleLabel,
                tabIndex: -1,
                className:
                  'text-text-muted hover:text-text-default rounded-control cursor-pointer px-2 py-2 leading-none',
              })}
            >
              <span aria-hidden="true">▾</span>
            </button>
          </div>

          {/*
           * Always rendered - downshift needs the ref whether or not it is open
           * - and always named by the field's own label, so the listbox does
           * not arrive in the rotor as a second, anonymous thing.
           */}
          <ul
            {...getMenuProps({
              'aria-labelledby': meta.labelId,
              className: cx(
                'border-border-default bg-surface-raised rounded-chamfer absolute inset-x-0 z-20 mt-1 max-h-64 overflow-y-auto border py-1 shadow-lg',
                isOpen ? null : 'hidden',
              ),
            })}
          >
            {isOpen ? (
              <Options
                matches={matches}
                selected={selected}
                highlightedIndex={highlightedIndex}
                getItemProps={getItemProps}
                noResults={copy.noResults}
              />
            ) : null}
          </ul>

          <Announcer copy={copy} isOpen={isOpen} count={matches.length} selected={selected} />
        </div>
      )}
    </Field>
  );
}

/*
 * The rows. Split out for length only - it is the inside of the listbox above,
 * not a component anything else may mount.
 */
function Options({
  matches,
  selected,
  highlightedIndex,
  getItemProps,
  noResults,
}: {
  matches: readonly CountryOption[];
  selected: CountryOption | null;
  highlightedIndex: number;
  getItemProps: ReturnType<typeof useCombobox<CountryOption>>['getItemProps'];
  noResults: string;
}) {
  if (matches.length === 0) {
    return <li className="text-text-muted px-3 py-2">{noResults}</li>;
  }

  return matches.map((country, index) => {
    const current = selected?.code === country.code;
    return (
      <li
        key={country.code}
        {...getItemProps({
          item: country,
          index,
          className: cx(
            'flex cursor-pointer items-center gap-2 px-3 py-2',
            highlightedIndex === index ? 'bg-surface-sunken' : null,
          ),
        })}
        /*
         * `aria-selected` is downshift's, and it tracks the *highlight* - the
         * option Enter would take. Which country the form currently holds is a
         * different fact and gets `aria-current`, plus a glyph, because colour
         * is never the only signal.
         */
        aria-current={current ? true : undefined}
      >
        <Flag code={country.code} />
        <span className="min-w-0 flex-1">{country.name}</span>
        {/*
         * A real space, not a gap. Flex discards a whitespace-only text node
         * between items, so this changes nothing visually - but accessible
         * names are built by concatenating text, and without it the row is
         * announced as "SchwedenSE".
         */}{' '}
        <span className="text-text-muted font-mono text-[length:var(--type-ui-size-sm)] tabular-nums">
          {country.code}
        </span>
        <span aria-hidden="true" className={current ? undefined : 'invisible'}>
          ✓
        </span>
      </li>
    );
  });
}

/**
 * A 4:3 flag, sized by the text it sits beside.
 *
 * The bordered blank is not a missing state - it is the shape the row keeps
 * before anything is chosen, so selecting a country does not shift the label
 * and the caret sideways.
 *
 * No width or height utilities: `flag-icons` ships **unlayered** CSS, which
 * outranks every Tailwind utility regardless of specificity, so `w-4` here
 * would silently lose to `.fi { width: 1.333em }`. The border is safe - that is
 * a property `.fi` does not set - and it is what keeps Japan's flag from
 * disappearing into a light surface.
 */
function Flag({ code }: { code?: string | undefined }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'border-border-default inline-block h-[1em] w-[1.333em] shrink-0 rounded-[1px] border',
        code === undefined ? 'bg-surface-sunken' : `fi fi-${code.toLowerCase()}`,
      )}
    />
  );
}

/**
 * What a screen reader is told, in the caller's language.
 *
 * downshift's hooks ship **no** status message unless one is passed (its older
 * component API defaults to English prose), so this is the announcement's only
 * source. Without it the widget is silent about the two things that change
 * while focus stays put: how many countries survived the last keystroke, and
 * which one was finally chosen.
 *
 * Rendered here rather than handed to `getA11yStatusMessage` so the live region
 * belongs to this component's tree and leaves with it, instead of being
 * appended to `document.body` and outliving the form.
 */
function Announcer({
  copy,
  isOpen,
  count,
  selected,
}: {
  copy: CountrySelectCopy;
  isOpen: boolean;
  count: number;
  selected: CountryOption | null;
}) {
  const message = isOpen
    ? count === 0
      ? copy.noResults
      : copy.resultsAnnouncement.replace('{count}', String(count))
    : selected
      ? copy.selectionAnnouncement.replace('{country}', selected.name)
      : '';

  return (
    <div role="status" aria-live="polite">
      <VisuallyHidden>{message}</VisuallyHidden>
    </div>
  );
}
