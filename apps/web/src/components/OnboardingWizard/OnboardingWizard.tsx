'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Alert } from '@beff/ui/alert';
import { Button } from '@beff/ui/button';
import { CountrySelect } from '@beff/ui/country-select';
import { DataState } from '@beff/ui/data-state';
import { Display } from '@beff/ui/display';
import { Field } from '@beff/ui/field';
import { TextField } from '@beff/ui/text-field';

import { ONBOARDING_ROUTES } from '@/constants/api';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { authFetch } from '@/lib/auth';
import { getCountries, getCountryName } from '@/lib/countries';
import { getDictionary, type Locale } from '@/lib/i18n';
import { surfacePath } from '@/lib/navigation';

import {
  REQUIRED_BY_STEP,
  STEPS,
  isStep,
  type OnboardingAnswers,
  type OnboardingProgress,
  type Step,
} from './steps';

const SELECT_CLASS = 'border-border-default bg-surface-base rounded-chamfer border px-3 py-2';

/**
 * ## Resumable by construction
 *
 * Progress is persisted server-side after every step, not held in component
 * state and not in `sessionStorage`. The ENG-30 verification is "interrupt
 * mid-wizard, reload, resume at the same step" - and an engineer being
 * interrupted mid-task is the normal case on a factory floor, not an edge one.
 *
 * The consequence is that the **server owns which step you are on**. This
 * component reads it and never assumes the first one.
 */
export function OnboardingWizard({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, status } = useQuery({
    queryKey: QUERY_KEYS.onboarding,
    queryFn: () => authFetch<OnboardingProgress>(ONBOARDING_ROUTES.progress),
    // Always refetched on mount: the whole point is that another tab or an
    // earlier session may have moved this forward.
    staleTime: 0,
  });

  const [step, setStep] = useState<Step>('role');
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [resumed, setResumed] = useState(false);
  const hydrated = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (data === undefined || hydrated.current) return;
    hydrated.current = true;

    if (data.completed_at !== null) {
      router.replace(surfacePath('dashboard', locale));
      return;
    }

    const server = isStep(data.current_step) ? data.current_step : 'role';
    setStep(server);
    setAnswers(data.answers);
    setResumed(server !== 'role' || Object.keys(data.answers).length > 0);
  }, [data, router, locale]);

  const save = useMutation({
    mutationFn: (next: { current_step: Step; answers: OnboardingAnswers }) =>
      authFetch<OnboardingProgress>(ONBOARDING_ROUTES.progress, { method: 'PUT', body: next }),
    onSuccess: (saved) => {
      queryClient.setQueryData(QUERY_KEYS.onboarding, saved);
    },
  });

  const complete = useMutation({
    mutationFn: () => authFetch<OnboardingProgress>(ONBOARDING_ROUTES.complete, { method: 'POST' }),
    onSuccess: () => {
      router.push(surfacePath('dashboard', locale));
    },
  });

  const index = STEPS.indexOf(step);
  const missing = REQUIRED_BY_STEP[step].filter((key) => !answers[key]?.trim());

  const set = (key: keyof OnboardingAnswers, value: string): void => {
    setAnswers((previous) => ({ ...previous, [key]: value }));
  };

  const goTo = (next: Step): void => {
    setStep(next);
    save.mutate({ current_step: next, answers });
    // Focus moves to the new step's heading. Without it focus stays on a button
    // that no longer exists, and a screen reader announces nothing at all -
    // the user is left on a page that silently changed underneath them.
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const copy = t.onboarding.steps;
  const countries = getCountries(locale);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <DataState
        status={status === 'pending' ? 'loading' : status === 'error' ? 'error' : 'ready'}
        loadingLabel={t.common.loading}
        // The wizard has no empty state - the step list is a constant, so a
        // successful load always has something to render. The title is supplied
        // anyway because `DataState` will not let a caller leave a user-facing
        // string to a default, and a default is how the German pages ended up
        // announcing English.
        emptyTitle={t.errors.unexpectedTitle}
        errorTitle={t.errors.unexpectedTitle}
        errorBody={<p>{t.errors.unexpectedBody}</p>}
        alertPrefixes={t.a11y.alertPrefixes}
      >
        <div className="mx-auto max-w-lg">
          <p className="text-text-muted text-[length:var(--type-ui-size-sm)]">
            {t.onboarding.stepOf
              .replace('{current}', String(index + 1))
              .replace('{total}', String(STEPS.length))}
          </p>

          {/* A real `<progress>`, so assistive technology gets the position
            without a hand-rolled ARIA widget. */}
          <progress
            value={index + 1}
            max={STEPS.length}
            className="mt-2 h-1 w-full"
            aria-label={t.onboarding.title}
          />

          {resumed ? (
            <div className="mt-6">
              <Alert
                tone="info"
                announce
                title={t.onboarding.resumeNotice}
                prefixes={t.a11y.alertPrefixes}
              />
            </div>
          ) : null}

          <Display as="h1" className="mt-8" ref={headingRef} tabIndex={-1}>
            {copy[step].title}
          </Display>
          <p className="text-text-muted mt-2">{copy[step].body}</p>

          <div className="mt-10 flex flex-col gap-6">
            {step === 'role' ? (
              <Field label={copy.role.label} required>
                {(control) => (
                  <select
                    {...control}
                    value={answers.role ?? ''}
                    onChange={(event) => {
                      set('role', event.target.value);
                    }}
                    className={SELECT_CLASS}
                  >
                    <option value="" disabled>
                      -
                    </option>
                    {Object.entries(copy.role.options).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            ) : null}

            {step === 'plant' ? (
              <>
                <TextField
                  label={copy.plant.nameLabel}
                  value={answers.plant_name ?? ''}
                  onChange={(event) => {
                    set('plant_name', event.target.value);
                  }}
                  required
                />
                {/*
                 * Was a two-character text box asking for `ISO 3166-1 alpha-2,
                 * e.g. DE` - in English, on the German page, because the hint
                 * was a literal in this file. It also asked a process engineer
                 * to know that Austria is AT and not OE. The stored answer is
                 * still the alpha-2 code the `plants` CHECK constraint wants;
                 * only the way it is chosen changed.
                 */}
                <CountrySelect
                  label={copy.plant.countryLabel}
                  countries={countries}
                  copy={copy.plant.country}
                  value={answers.plant_country}
                  onChange={(code) => {
                    set('plant_country', code);
                  }}
                  required
                />
              </>
            ) : null}

            {step === 'lines' ? (
              <>
                <TextField
                  label={copy.lines.nameLabel}
                  value={answers.line_name ?? ''}
                  onChange={(event) => {
                    set('line_name', event.target.value);
                  }}
                  required
                />
                <Field label={copy.lines.kindLabel} required>
                  {(control) => (
                    <select
                      {...control}
                      value={answers.line_kind ?? ''}
                      onChange={(event) => {
                        set('line_kind', event.target.value);
                      }}
                      className={SELECT_CLASS}
                    >
                      <option value="" disabled>
                        -
                      </option>
                      <option value="pilot">{copy.lines.kindPilot}</option>
                      <option value="production">{copy.lines.kindProduction}</option>
                    </select>
                  )}
                </Field>
                <Field label={copy.lines.formatLabel} required>
                  {(control) => (
                    <select
                      {...control}
                      value={answers.cell_format ?? ''}
                      onChange={(event) => {
                        set('cell_format', event.target.value);
                      }}
                      className={SELECT_CLASS}
                    >
                      <option value="" disabled>
                        -
                      </option>
                      <option value="pouch">{copy.lines.formatPouch}</option>
                      <option value="prismatic">{copy.lines.formatPrismatic}</option>
                      <option value="cylindrical">{copy.lines.formatCylindrical}</option>
                    </select>
                  )}
                </Field>
              </>
            ) : null}

            {step === 'units' ? (
              <Field label={copy.units.label} required>
                {(control) => (
                  <select
                    {...control}
                    value={answers.unit_system ?? ''}
                    onChange={(event) => {
                      set('unit_system', event.target.value);
                    }}
                    className={SELECT_CLASS}
                  >
                    <option value="" disabled>
                      -
                    </option>
                    <option value="metric">{copy.units.metric}</option>
                    <option value="imperial">{copy.units.imperial}</option>
                  </select>
                )}
              </Field>
            ) : null}

            {step === 'review' ? (
              <dl className="grid gap-2 sm:grid-cols-[12rem_1fr]">
                {(
                  [
                    [copy.role.label, answers.role],
                    [copy.plant.nameLabel, answers.plant_name],
                    /*
                     * The name, not the code. The user picked `Deutschland`;
                     * echoing `DE` back at them on the confirmation step asks
                     * them to verify a translation they never made.
                     */
                    [
                      copy.plant.countryLabel,
                      answers.plant_country === undefined
                        ? undefined
                        : getCountryName(answers.plant_country, locale),
                    ],
                    [copy.lines.nameLabel, answers.line_name],
                    [copy.lines.kindLabel, answers.line_kind],
                    [copy.lines.formatLabel, answers.cell_format],
                    [copy.units.label, answers.unit_system],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-text-muted">{label}</dt>
                    <dd>{value ?? '-'}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          <div className="mt-10 flex items-center gap-3">
            {index > 0 ? (
              <Button
                variant="secondary"
                onClick={() => {
                  const previous = STEPS[index - 1];
                  if (previous !== undefined) goTo(previous);
                }}
              >
                {t.onboarding.back}
              </Button>
            ) : null}

            {step === 'review' ? (
              <Button
                // The server re-checks this; the client copy only saves a round
                // trip, because a client check can always be bypassed.
                disabled={(data?.missing?.length ?? 0) > 0}
                loading={complete.isPending}
                loadingLabel={t.onboarding.finishing}
                onClick={() => {
                  complete.mutate();
                }}
              >
                {t.onboarding.finish}
              </Button>
            ) : (
              <Button
                disabled={missing.length > 0}
                onClick={() => {
                  const next = STEPS[index + 1];
                  if (next !== undefined) goTo(next);
                }}
              >
                {t.onboarding.next}
              </Button>
            )}
          </div>
        </div>
      </DataState>
    </div>
  );
}
