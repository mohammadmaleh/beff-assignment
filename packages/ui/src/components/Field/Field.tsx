import { useId, type ReactNode } from 'react';

/** The wiring a control needs in order to be described and validated correctly. */
export interface FieldControlProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
  required: boolean | undefined;
}

export interface FieldProps {
  label: string;
  /** Persistent help text. Not a placeholder — placeholders disappear on input. */
  description?: string;
  /**
   * Server-sourced message. The backend renders RFC 9457 Problem Details with a
   * per-field breakdown, so this string is translated from a stable code rather
   * than parsed out of English prose.
   */
  error?: string;
  required?: boolean;
  children: (props: FieldControlProps) => ReactNode;
}

/**
 * Label, control, description and error, wired together.
 *
 * The label is a real `<label for>` rather than `aria-label`: native HTML
 * before ARIA. That also buys the click-to-focus behaviour for free, which
 * `aria-label` does not.
 */
export function Field({ label, description, error, required, children }: FieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  // Order matters — a screen reader reads `aria-describedby` in the order given,
  // and the error is the more urgent of the two.
  const describedBy = [error ? errorId : null, description ? descriptionId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[length:var(--type-ui-size-sm)] font-medium">
        {label}
        {required ? (
          <span className="text-text-muted ms-1" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {description ? (
        <p id={descriptionId} className="text-text-muted text-[length:var(--type-ui-size-sm)]">
          {description}
        </p>
      ) : null}

      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
        required: required || undefined,
      })}

      {/*
       * Colour is never the only signal — the message carries a glyph and, being
       * text, is readable to anyone. `role="alert"` announces it when validation
       * comes back from the server without the user having to hunt for it.
       */}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-status-danger-fg flex items-start gap-1.5 text-[length:var(--type-ui-size-sm)]"
        >
          <span aria-hidden="true">✕</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
