import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Field } from './Field.js';

/** A bare control, so these assertions cover Field's wiring and nothing else. */
const renderField = (props: Partial<Parameters<typeof Field>[0]> = {}) =>
  render(
    <Field label="Plant name" {...props}>
      {(control) => <input {...control} />}
    </Field>,
  );

describe('Field', () => {
  it('generates a unique id and points the label at it', () => {
    renderField();
    expect(screen.getByLabelText('Plant name')).toBeInTheDocument();
  });

  it('gives two fields on the same page different ids', () => {
    // `useId` rather than a module counter — a counter is not stable across a
    // server render and its hydration, and React logs a mismatch.
    render(
      <>
        <Field label="First">{(c) => <input {...c} />}</Field>
        <Field label="Second">{(c) => <input {...c} />}</Field>
      </>,
    );
    expect(screen.getByLabelText('First').id).not.toBe(screen.getByLabelText('Second').id);
  });

  it('marks the control required rather than only starring the label', () => {
    renderField({ required: true });
    expect(screen.getByRole('textbox')).toBeRequired();
  });

  it('keeps the required asterisk out of the accessible name', () => {
    // `required` on the control already announces it; reading "star" as well is
    // noise. The asterisk is `aria-hidden`, which the accessible-name algorithm
    // honours — note that Testing Library's own `getByLabelText` does *not*,
    // because it matches on textContent. `toHaveAccessibleName` runs the real
    // algorithm, so this asserts what a screen reader will actually say.
    renderField({ required: true });
    expect(screen.getByRole('textbox')).toHaveAccessibleName('Plant name');
  });

  it('describes the control with its help text', () => {
    renderField({ description: 'As it appears on the line report.' });
    expect(screen.getByLabelText('Plant name')).toHaveAccessibleDescription(
      'As it appears on the line report.',
    );
  });

  it('adds nothing to aria-describedby when there is neither description nor error', () => {
    renderField();
    expect(screen.getByLabelText('Plant name')).not.toHaveAttribute('aria-describedby');
  });

  it('announces a server-sourced error', () => {
    renderField({ error: 'A plant with that name already exists.' });
    expect(screen.getByRole('alert')).toHaveTextContent('A plant with that name already exists.');
    expect(screen.getByLabelText('Plant name')).toHaveAttribute('aria-invalid', 'true');
  });
});
