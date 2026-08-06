'use client';

import { useState, type FormEvent } from 'react';

import { Alert } from '@beff/ui/alert';
import { Button } from '@beff/ui/button';
import { TextField } from '@beff/ui/text-field';

import { WAITLIST_ROUTE } from '@/constants/api';
import { apiUrl, problemFieldErrors, type FieldErrors } from '@/lib/api';
import { textField } from '@/lib/forms';
import { getDictionary, translateFieldError, type Locale } from '@/lib/i18n';

type Status = 'idle' | 'submitting' | 'sent' | 'failed';

/**
 * The one interactive element on an otherwise static page.
 *
 * Validation messages come from the server's RFC 9457 Problem Details, keyed by
 * a stable code rather than parsed out of English prose - so the German locale
 * shows German errors without the backend knowing which language is on screen.
 */
export function WaitlistForm({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<FieldErrors>({});

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setStatus('submitting');
    setErrors({});

    const data = new FormData(event.currentTarget);

    try {
      const response = await fetch(apiUrl(WAITLIST_ROUTE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Language': locale },
        body: JSON.stringify({
          email: textField(data, 'email'),
          company: textField(data, 'company'),
        }),
      });

      if (response.ok) {
        setStatus('sent');
        return;
      }

      const fieldErrors = await problemFieldErrors(response);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        setStatus('idle');
        return;
      }
      setStatus('failed');
    } catch {
      // A network failure, not a validation failure. Saying "check your email
      // address" here would send the user hunting for a mistake they did not
      // make.
      setStatus('failed');
    }
  };

  if (status === 'sent') {
    return (
      <Alert tone="success" title={t.landing.waitlistSuccessTitle} prefixes={t.a11y.alertPrefixes}>
        <p>{t.landing.waitlistSuccessBody}</p>
      </Alert>
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-6">
      {/*
       * `noValidate` hands validation to the server, which is the only place
       * that knows whether an address is already on the list. The browser's own
       * bubble cannot be styled, cannot be translated, and disappears on blur.
       */}
      <TextField
        label={t.landing.waitlistEmailLabel}
        description={t.landing.waitlistEmailDescription}
        name="email"
        type="email"
        autoComplete="email"
        required
        {...(errors.email === undefined
          ? {}
          : { error: translateFieldError(locale, errors.email) })}
      />
      <TextField
        label={t.landing.waitlistCompanyLabel}
        name="company"
        autoComplete="organization"
        required
        {...(errors.company === undefined
          ? {}
          : { error: translateFieldError(locale, errors.company) })}
      />

      {status === 'failed' ? (
        <Alert tone="danger" title={t.landing.waitlistErrorTitle} prefixes={t.a11y.alertPrefixes}>
          <p>{t.landing.waitlistErrorBody}</p>
        </Alert>
      ) : null}

      <div>
        <Button
          type="submit"
          loading={status === 'submitting'}
          loadingLabel={t.landing.waitlistSubmitting}
        >
          {t.landing.waitlistSubmit}
        </Button>
      </div>
    </form>
  );
}
