import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CountrySelect, type CountrySelectCopy, type CountrySelectProps } from './CountrySelect';
import { matchCountries, type CountryOption } from './matching';

/**
 * A deliberately German list.
 *
 * This picker's hard cases are all German: the umlaut that can be typed two
 * ways, the name that looks nothing like its English one (`Frankreich`), and
 * the one that runs to thirty characters. An English fixture would pass a
 * picker that fails on the shipped locale.
 */
const COUNTRIES: readonly CountryOption[] = [
  { code: 'AT', name: 'Österreich' },
  { code: 'BE', name: 'Belgien' },
  { code: 'CN', name: 'China' },
  { code: 'DE', name: 'Deutschland' },
  { code: 'FR', name: 'Frankreich' },
  { code: 'SE', name: 'Schweden' },
  { code: 'US', name: 'Vereinigte Staaten von Amerika' },
];

const COPY: CountrySelectCopy = {
  placeholder: 'Land suchen',
  noResults: 'Kein Land gefunden',
  toggleLabel: 'Länderliste öffnen',
  resultsAnnouncement: '{count} Länder gefunden',
  selectionAnnouncement: '{country} ausgewählt',
};

/**
 * Controlled, like the wizard that uses it.
 *
 * A spy alone would leave `value` frozen, and downshift takes `selectedItem` as
 * a controlled prop - so every assertion after a selection would be measuring a
 * component whose parent refused the answer, which is not the case under test.
 */
function setup(props: Partial<CountrySelectProps> = {}) {
  const onChange = vi.fn();

  function Harness() {
    const [value, setValue] = useState(props.value);
    return (
      <CountrySelect
        label="Land"
        countries={COUNTRIES}
        copy={COPY}
        {...props}
        value={value}
        onChange={(code) => {
          setValue(code);
          onChange(code);
        }}
      />
    );
  }

  return { onChange, user: userEvent.setup(), ...render(<Harness />) };
}

const input = (): HTMLElement => screen.getByRole('combobox', { name: /^Land/ });
const options = (): HTMLElement[] => screen.queryAllByRole('option');
const open = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: COPY.toggleLabel }));
};

describe('matchCountries', () => {
  it('returns the list untouched for an empty query, in the order it was given', () => {
    // The caller's order is a locale-aware collation. Re-sorting here would
    // silently apply one language's rules to every other language's list.
    expect(matchCountries(COUNTRIES, '  ')).toEqual(COUNTRIES);
  });

  it('matches a name however the umlaut was typed', () => {
    expect(matchCountries(COUNTRIES, 'öster')[0]?.code).toBe('AT');
    expect(matchCountries(COUNTRIES, 'oster')[0]?.code).toBe('AT');
    expect(matchCountries(COUNTRIES, 'oester')[0]?.code).toBe('AT');
  });

  it('ranks the exact ISO code first, then prefixes, then anything containing it', () => {
    // `de` is the code for Germany and a substring of Schweden. Filtering alone
    // would offer Sweden first, on a German page, for the query `de`.
    expect(matchCountries(COUNTRIES, 'de').map((country) => country.code)).toEqual(['DE', 'SE']);
  });

  it('is case-insensitive on both the code and the name', () => {
    expect(matchCountries(COUNTRIES, 'FRANK').map((country) => country.code)).toEqual(['FR']);
    expect(matchCountries(COUNTRIES, 'at').map((country) => country.code)).toEqual(['AT', 'US']);
  });

  it('drops everything that does not match rather than falling back to the full list', () => {
    // A picker that answers `zzz` with all 250 countries looks like it ignored
    // the query, which is worse than saying it found nothing.
    expect(matchCountries(COUNTRIES, 'zzz')).toEqual([]);
  });

  it('hands back a copy, never the caller’s array', () => {
    // downshift's `items` is a mutable type. This is the array it receives.
    expect(matchCountries(COUNTRIES, '')).not.toBe(COUNTRIES);
  });
});

describe('CountrySelect', () => {
  it('shows the selected country by name, not by code, when it is given one', () => {
    // The render after a reload: all the wizard kept was the persisted `DE`.
    setup({ value: 'DE' });
    expect(input()).toHaveValue('Deutschland');
  });

  it('accepts a lowercase code, because the API folds case and clients do not', () => {
    setup({ value: 'de' });
    expect(input()).toHaveValue('Deutschland');
  });

  it('opens on the toggle and lists every country', async () => {
    const { user } = setup();
    await open(user);
    expect(options()).toHaveLength(COUNTRIES.length);
  });

  it('filters as you type', async () => {
    const { user } = setup();
    await user.type(input(), 'schwe');
    expect(options()).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Schweden SE' })).toBeInTheDocument();
  });

  it('reports its emptiness in the caller’s language and offers nothing to pick', async () => {
    const { user } = setup();
    await user.type(input(), 'zzz');
    // Twice over: in the list for whoever is looking at it, and in the live
    // region for whoever is not.
    expect(within(screen.getByRole('listbox')).getByText(COPY.noResults)).toBeInTheDocument();
    expect(await screen.findByText(COPY.noResults, { selector: '.sr-only' })).toBeInTheDocument();
    expect(options()).toHaveLength(0);
  });

  it('is named by the field’s label and by nothing that does not exist', () => {
    // downshift points `aria-labelledby` at a label it expects you to render
    // from its own `getLabelProps`. A dangling reference is not a weaker name -
    // it is no name, and the `<label for>` underneath only masks it.
    setup();
    const labelId = input().getAttribute('aria-labelledby');
    expect(labelId).not.toBeNull();
    expect(document.getElementById(labelId!)).toHaveTextContent('Land');
  });

  it('emits the ISO code, never the name, when an option is clicked', async () => {
    const { user, onChange } = setup();
    await user.type(input(), 'frank');
    await user.click(screen.getByRole('option', { name: /Frankreich/ }));
    expect(onChange).toHaveBeenCalledWith('FR');
    expect(input()).toHaveValue('Frankreich');
  });

  it('is operable from the keyboard alone', async () => {
    const { user, onChange } = setup();
    await user.tab();
    // The first ArrowDown opens on Österreich; the second lands on Belgien.
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('BE');
  });

  it('reopens on the whole list rather than on the selection it already made', async () => {
    // The box holds `Deutschland` after a choice. Filtering by it would offer
    // exactly one country - the chosen one - so changing your mind would mean
    // clearing the field first.
    const { user } = setup({ value: 'DE' });
    await open(user);
    expect(options()).toHaveLength(COUNTRIES.length);
  });

  it('marks the country the form actually holds, with more than a colour', async () => {
    const { user } = setup({ value: 'DE' });
    await open(user);
    const germany = screen.getByRole('option', { name: /Deutschland/ });
    // `aria-selected` is downshift's and tracks the highlight - the option
    // Enter would take. Which one is *held* is a different fact.
    expect(germany).toHaveAttribute('aria-current', 'true');
    expect(within(germany).getByText('✓')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Belgien/ })).not.toHaveAttribute('aria-current');
  });

  it('does not let a half-typed country survive as the visible answer', async () => {
    // Blur with `franz` in the box and Germany selected: the field would
    // otherwise read as France while the form still submits DE.
    const { user, onChange } = setup({ value: 'DE' });
    await user.type(input(), 'franz');
    await user.tab();
    expect(input()).toHaveValue('Deutschland');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('names each option by its country, leaving the flag out of the announcement', async () => {
    const { user } = setup();
    await open(user);
    const option = screen.getByRole('option', { name: 'Österreich AT' });
    // The flag is the one part of the row a screen reader must not read: it
    // says what the name already said, in a language nobody speaks.
    const flag = option.querySelector('.fi');
    expect(flag).toHaveAttribute('aria-hidden', 'true');
    expect(flag).toHaveClass('fi-at');
  });

  it('shows the chosen country’s flag in the field itself', async () => {
    const { user, container } = setup();
    expect(container.querySelector('.fi-fr')).toBeNull();

    await user.type(input(), 'frank');
    await user.click(screen.getByRole('option', { name: /Frankreich/ }));
    expect(container.querySelector('.fi-fr')).not.toBeNull();
  });

  it('announces the result count through the copy it was given', async () => {
    // downshift's hooks ship no status message unless one is passed, and its
    // component API's default is English prose. Either way the announcement is
    // the caller's to write: a German page cannot have an English one.
    const { user } = setup();
    await user.type(input(), 'e');
    expect(await screen.findByText('6 Länder gefunden')).toBeInTheDocument();
  });

  it('announces the selection, which is otherwise a silent change of value', async () => {
    const { user } = setup();
    await user.type(input(), 'china');
    await user.click(screen.getByRole('option', { name: /China/ }));
    expect(await screen.findByText('China ausgewählt')).toBeInTheDocument();
  });

  it('carries the field wiring - required, description and server error', () => {
    setup({
      value: 'DE',
      required: true,
      description: 'Standort des Werks',
      error: 'Bitte wählen Sie ein Land',
    });
    expect(input()).toBeRequired();
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(input()).toHaveAccessibleDescription(/Bitte wählen Sie ein Land/);
    expect(input()).toHaveAccessibleDescription(/Standort des Werks/);
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte wählen Sie ein Land');
  });

  it('gives the listbox the field’s own label rather than a second, invented one', async () => {
    const { user } = setup();
    await open(user);
    expect(screen.getByRole('listbox', { name: 'Land' })).toBeInTheDocument();
  });

  it('leaves the widget one tab stop, as the APG pattern has it', () => {
    const { user } = setup();
    void user;
    expect(screen.getByRole('button', { name: COPY.toggleLabel })).toHaveAttribute(
      'tabindex',
      '-1',
    );
  });

  it('turns off browser autofill, which would otherwise cover the list it is filtering', () => {
    // A native autofill dropdown paints over the listbox and steals the arrow
    // keys - the one browser behaviour a combobox cannot coexist with.
    setup();
    expect(input()).toHaveAttribute('autocomplete', 'off');
  });
});
