import { useState } from 'react';

import { CountrySelect } from './CountrySelect';

import type { CountryOption, CountrySelectCopy } from './CountrySelect';
import type { Meta, StoryObj } from '@storybook/react-vite';

/*
 * A slice of the real list, not a toy one. The picker's hard cases are the long
 * German name, the umlaut that can be typed `ö` or `oe`, and the two countries
 * whose names share a substring with another's ISO code.
 */
const DE_COUNTRIES: readonly CountryOption[] = [
  { code: 'BE', name: 'Belgien' },
  { code: 'CN', name: 'China' },
  { code: 'DE', name: 'Deutschland' },
  { code: 'FR', name: 'Frankreich' },
  { code: 'JP', name: 'Japan' },
  { code: 'AT', name: 'Österreich' },
  { code: 'PL', name: 'Polen' },
  { code: 'SE', name: 'Schweden' },
  { code: 'CH', name: 'Schweiz' },
  { code: 'KR', name: 'Südkorea' },
  { code: 'HU', name: 'Ungarn' },
  { code: 'US', name: 'Vereinigte Staaten von Amerika' },
];

const EN_COUNTRIES: readonly CountryOption[] = [
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CN', name: 'China' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'HU', name: 'Hungary' },
  { code: 'JP', name: 'Japan' },
  { code: 'PL', name: 'Poland' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'US', name: 'United States of America' },
];

const EN: CountrySelectCopy = {
  placeholder: 'Search countries',
  noResults: 'No country matches that',
  toggleLabel: 'Show countries',
  resultsAnnouncement: '{count} countries available',
  selectionAnnouncement: '{country} selected',
};

const DE: CountrySelectCopy = {
  placeholder: 'Land suchen',
  noResults: 'Kein Land gefunden',
  toggleLabel: 'Länderliste anzeigen',
  resultsAnnouncement: '{count} Länder verfügbar',
  selectionAnnouncement: '{country} ausgewählt',
};

/**
 * A country picker you can type into.
 *
 * ## Why it is not a `<select>`
 *
 * *Native HTML before ARIA* is the house rule, and this is the one control that
 * wins the argument against it. A `<select>` of 250 options has type-ahead, but
 * it matches from the **start** of the option text only — so `land` never finds
 * `Deutschland`, and a German user typing `oe` never finds `Österreich`. It
 * also cannot draw a flag. So the pattern is the ARIA 1.2 combobox, and the
 * concession to the rule is that none of it is hand-rolled: `downshift` owns
 * the roles, the `aria-activedescendant` bookkeeping and the key map.
 *
 * ## What the flags are and are not
 *
 * They are `aria-hidden` decoration over a row that already says the country's
 * name and its ISO code in text. A flag is a picture of a political claim; it
 * is never the only way to tell two rows apart here, and it is never announced.
 *
 * ## Every string is a required prop
 *
 * Including the two that only a screen-reader user ever meets. A default here
 * would be a guess at the page's language that ships — and one that axe,
 * screenshots and the contrast gate are all indifferent to, because they cannot
 * tell which language a well-formed string is in.
 */
const meta = {
  title: 'Forms/CountrySelect',
  component: CountrySelect,
  parameters: { layout: 'centered' },
  // Story-local state: the component is controlled, and a picker that cannot
  // keep what you picked documents nothing.
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <div className="w-80">
        <CountrySelect {...args} value={value} onChange={setValue} />
      </div>
    );
  },
} satisfies Meta<typeof CountrySelect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const English: Story = {
  args: { label: 'Country', countries: EN_COUNTRIES, copy: EN, onChange: () => {}, required: true },
};

/** The shipped locale. Note the width the longest name needs. */
export const German: Story = {
  args: {
    label: 'Land',
    countries: DE_COUNTRIES,
    copy: DE,
    onChange: () => {},
    required: true,
    description: 'Standort des Werks',
  },
};

/** Resumed from a saved answer: the code was persisted, the name is rendered. */
export const WithSelection: Story = {
  args: { ...German.args, value: 'DE' },
};

/** Server-side validation, translated from a stable code — never parsed prose. */
export const WithError: Story = {
  args: { ...German.args, error: 'Bitte wählen Sie ein Land aus.' },
};
