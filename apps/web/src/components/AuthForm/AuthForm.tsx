'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@beff/ui/alert';
import { Button } from '@beff/ui/button';
import { TextField } from '@beff/ui/text-field';

import { ApiError, useAuth } from '@/lib/auth';
import { textField } from '@/lib/forms';
import { getDictionary, translateFieldError, type Locale } from '@/lib/i18n';
import { surfacePath } from '@/lib/navigation';

type Mode = 'login' | 'register';

/**
 * Login and registration are the same form with one extra field, so they are
 * one component. Two near-identical files drift, and the one that drifts is
 * always the one with the accessibility wiring.
 */
export function AuthForm({ mode, locale }: { mode: Mode; locale: Locale }) {
  const t = getDictionary(locale);
  const router = useRouter();
  const { login, register } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    const data = new FormData(event.currentTarget);
    const email = textField(data, 'email');
    const password = textField(data, 'password');

    try {
      if (mode === 'login') {
        await login(email, password);
        router.push(surfacePath('dashboard', locale));
      } else {
        await register(email, password, textField(data, 'display_name'));
        // Straight into onboarding: an account with no plant and no line cannot
        // render a dashboard, and bouncing off an empty one teaches the user
        // the product is broken.
        router.push(surfacePath('onboarding', locale));
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (Object.keys(error.fields).length > 0) {
          setFieldErrors(error.fields);
        } else {
          // 401 on login is a credential mismatch, and it must not say *which*
          // of the two was wrong — that turns the form into an account
          // enumeration oracle.
          setFormError(error.status === 401 ? t.auth.invalidCredentials : t.auth.genericFailure);
        }
      } else {
        setFormError(t.auth.genericFailure);
      }
      setSubmitting(false);
    }
  };

  const errorFor = (field: string): { error: string } | Record<string, never> => {
    const code = fieldErrors[field];
    return code === undefined ? {} : { error: translateFieldError(locale, code) };
  };

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      // `onSubmit` calls `preventDefault`, but only once the bundle has
      // hydrated — and a form with no `method` submits by **GET** to its own
      // URL. A submit in the window before hydration therefore navigates to
      // `/en/login?email=…&password=…`, putting the password in the address
      // bar, in browser history, in the `Referer` of the next request, and in
      // every access log on the way. `post` is the fix: the same submit puts
      // the credentials in a request body that no route reads, so the visitor
      // lands back on the form — a dead end rather than a leak. There is no
      // server route to point an `action` at; auth is owned end to end by
      // FastAPI and this surface is client-rendered by design.
      method="post"
      noValidate
      className="flex flex-col gap-6"
    >
      {formError === null ? null : (
        <Alert tone="danger" title={t.auth.failedTitle} prefixes={t.a11y.alertPrefixes}>
          <p>{formError}</p>
        </Alert>
      )}

      {mode === 'register' ? (
        <TextField
          label={t.auth.nameLabel}
          name="display_name"
          autoComplete="name"
          required
          {...errorFor('display_name')}
        />
      ) : null}

      <TextField
        label={t.auth.emailLabel}
        name="email"
        type="email"
        autoComplete="email"
        required
        {...errorFor('email')}
      />

      <TextField
        label={t.auth.passwordLabel}
        {...(mode === 'register' ? { description: t.auth.passwordHint } : {})}
        name="password"
        type="password"
        // `current-password` on login and `new-password` on register is what
        // tells a password manager whether to offer a saved entry or generate
        // one. Getting it wrong is a silent, daily papercut.
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        required
        {...errorFor('password')}
      />

      <div>
        <Button
          type="submit"
          loading={submitting}
          loadingLabel={mode === 'login' ? t.auth.submittingLogin : t.auth.submittingRegister}
        >
          {mode === 'login' ? t.auth.submitLogin : t.auth.submitRegister}
        </Button>
      </div>
    </form>
  );
}
