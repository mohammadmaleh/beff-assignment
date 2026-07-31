import type { InputHTMLAttributes } from 'react';

import { cx } from '../../lib/cx/index';
import { Field, type FieldProps } from '../Field/index';

export interface TextFieldProps
  extends
    Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'required' | 'className'>,
    Omit<FieldProps, 'children'> {
  className?: string;
}

/**
 * A labelled text input. The borders carry the structure here because the
 * design brief settled on no cards anywhere — which makes `border-default`
 * load-bearing UI under WCAG 1.4.11, and it is gated at 3:1 for that reason.
 */
export function TextField({
  label,
  description,
  error,
  required,
  className,
  ...input
}: TextFieldProps) {
  return (
    <Field
      label={label}
      {...(description === undefined ? {} : { description })}
      {...(error === undefined ? {} : { error })}
      {...(required === undefined ? {} : { required })}
    >
      {(control) => (
        <input
          {...control}
          {...input}
          className={cx(
            'border-border-default bg-surface-base text-text-default rounded-chamfer border px-3 py-2',
            'placeholder:text-text-muted',
            'aria-invalid:border-status-danger-fg aria-invalid:border-2',
            'disabled:cursor-not-allowed disabled:opacity-55',
            className,
          )}
        />
      )}
    </Field>
  );
}
