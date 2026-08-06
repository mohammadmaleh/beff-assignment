'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@beff/ui/alert';
import { Button } from '@beff/ui/button';
import { Display } from '@beff/ui/display';
import { Lede } from '@beff/ui/lede';
import { TextField } from '@beff/ui/text-field';

import type { ConsentState, ExportJob } from '@beff/api-client/types';

import { PRIVACY_ROUTES } from '@/constants/api';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { apiUrl } from '@/lib/api';
import { authFetch, useAuth } from '@/lib/auth';
import { getDictionary, type Locale } from '@/lib/i18n';
import { surfacePath } from '@/lib/navigation';

// Both shapes come from the API's own OpenAPI document - see ENG-33. Declaring
// them here again is how a frontend keeps compiling against a contract the
// backend has already changed.

/**
 * Consent, export and erasure on one surface.
 *
 * The GDPR framing is deliberate and visible: each control names the article it
 * satisfies. That is not decoration - a data subject who can see that a control
 * *is* their Art. 17 right is a data subject who uses it here rather than by
 * writing to a supervisory authority.
 */
export function ProfileView({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const { user, logout } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const consent = useQuery({
    queryKey: QUERY_KEYS.consent,
    queryFn: () => authFetch<ConsentState>(PRIVACY_ROUTES.consent),
  });

  const setConsent = useMutation({
    mutationFn: (next: { purpose: string; granted: boolean }) =>
      // POST, never PUT. Consent records are append-only: proving *what* was
      // consented to and *when* is itself an obligation (Art. 7(1)), and an
      // UPDATE destroys the only evidence of the previous state.
      authFetch<ConsentState>(PRIVACY_ROUTES.consent, { method: 'POST', body: next }),
    onSuccess: (state) => {
      queryClient.setQueryData(QUERY_KEYS.consent, state);
    },
  });

  const exportJob = useQuery({
    queryKey: QUERY_KEYS.export,
    queryFn: () => authFetch<ExportJob | null>(PRIVACY_ROUTES.export),
    // Poll only while there is something to wait for. A fixed interval would
    // keep hitting the API forever on a page nobody is watching.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'running' ? 3000 : false;
    },
  });

  const requestExport = useMutation({
    mutationFn: () => authFetch<ExportJob>(PRIVACY_ROUTES.export, { method: 'POST' }),
    onSuccess: (job) => {
      queryClient.setQueryData(QUERY_KEYS.export, job);
    },
  });

  const [confirmation, setConfirmation] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const erase = useMutation({
    mutationFn: () => authFetch<void>(PRIVACY_ROUTES.erasure, { method: 'DELETE' }),
    onSuccess: async () => {
      await logout();
      router.replace(surfacePath('landing', locale));
    },
  });

  const job = exportJob.data ?? null;

  return (
    // `AppShell` no longer wraps its children in a measure - the dashboard
    // composes itself in full-bleed bands - so each surface sets its own.
    <div className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-12">
      <div>
        <Display as="h1">{t.profile.title}</Display>
      </div>

      <section aria-labelledby="details">
        <h2 id="details" className="text-[length:var(--type-ui-size-lg)] font-medium">
          {t.profile.detailsTitle}
        </h2>
        <dl className="mt-4 grid gap-2 sm:grid-cols-[10rem_1fr]">
          <dt className="text-text-muted">{t.auth.nameLabel}</dt>
          <dd>{user?.display_name}</dd>
          <dt className="text-text-muted">{t.auth.emailLabel}</dt>
          <dd>{user?.email}</dd>
        </dl>
      </section>

      <section aria-labelledby="consent" className="border-border-default border-t pt-8">
        <h2 id="consent" className="text-[length:var(--type-ui-size-lg)] font-medium">
          {t.profile.consentTitle}
        </h2>
        <Lede size="sm" className="mt-2">
          {t.profile.consentBody}
        </Lede>

        <ul className="mt-6 flex flex-col gap-3">
          {(
            [
              ['analytics', t.profile.consentAnalytics],
              ['marketing', t.profile.consentMarketing],
            ] as const
          ).map(([purpose, label]) => (
            <li key={purpose}>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={consent.data?.[purpose] ?? false}
                  disabled={consent.isPending || setConsent.isPending}
                  onChange={(event) => {
                    setConsent.mutate({ purpose, granted: event.target.checked });
                  }}
                />
                <span>{label}</span>
              </label>
            </li>
          ))}
        </ul>

        {setConsent.isPending ? (
          <p role="status" className="text-text-muted mt-3 text-[length:var(--type-ui-size-sm)]">
            {t.profile.consentSaving}
          </p>
        ) : null}
        {setConsent.isSuccess ? (
          <p role="status" className="text-text-muted mt-3 text-[length:var(--type-ui-size-sm)]">
            {t.profile.consentSaved}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="export" className="border-border-default border-t pt-8">
        <h2 id="export" className="text-[length:var(--type-ui-size-lg)] font-medium">
          {t.profile.exportTitle}
        </h2>
        <Lede size="sm" className="mt-2">
          {t.profile.exportBody}
        </Lede>

        <div className="mt-6 flex flex-col gap-4">
          {job?.status === 'pending' || job?.status === 'running' ? (
            <Alert
              tone="info"
              announce
              title={t.profile.exportPending}
              prefixes={t.a11y.alertPrefixes}
            />
          ) : null}
          {job?.status === 'failed' ? (
            <Alert tone="warning" title={t.profile.exportFailed} prefixes={t.a11y.alertPrefixes} />
          ) : null}
          {job?.status === 'ready' && job.download_path !== null ? (
            <Alert tone="success" title={t.profile.exportReady} prefixes={t.a11y.alertPrefixes}>
              <a href={apiUrl(job.download_path)} className="underline underline-offset-4" download>
                {t.profile.exportDownload}
              </a>
            </Alert>
          ) : null}

          <div>
            <Button
              variant="secondary"
              loading={requestExport.isPending}
              loadingLabel={t.profile.exportRequesting}
              onClick={() => {
                requestExport.mutate();
              }}
            >
              {t.profile.exportRequest}
            </Button>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="danger"
        className="border-status-danger-fg border-s-4 border-t-0 ps-4"
      >
        <h2
          id="danger"
          className="text-status-danger-fg text-[length:var(--type-ui-size-lg)] font-medium"
        >
          {t.profile.dangerTitle}
        </h2>
        <Lede size="sm" className="mt-2">
          {t.profile.dangerBody}
        </Lede>

        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            // Typing the word, not a modal with a red button. A confirmation
            // dialog is dismissed by muscle memory; typing DELETE cannot be.
            if (confirmation.trim() !== t.profile.dangerConfirmWord) {
              setConfirmError(t.profile.dangerMismatch);
              return;
            }
            setConfirmError(null);
            erase.mutate();
          }}
        >
          <div className="max-w-sm">
            <TextField
              label={t.profile.dangerConfirmLabel}
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
              }}
              autoComplete="off"
              {...(confirmError === null ? {} : { error: confirmError })}
            />
          </div>
          <div>
            <Button
              type="submit"
              variant="danger"
              loading={erase.isPending}
              loadingLabel={t.profile.dangerSubmitting}
            >
              {t.profile.dangerSubmit}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
