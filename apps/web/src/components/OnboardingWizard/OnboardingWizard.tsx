'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Alert } from '@beff/ui/alert';
import { Button } from '@beff/ui/button';
import { DataState } from '@beff/ui/data-state';
import { Field } from '@beff/ui/field';
import { TextField } from '@beff/ui/text-field';

import { authFetch } from '@/lib/auth';
import { getDictionary, type Locale } from '@/lib/i18n';
import { surfacePath } from '@/lib/navigation';

import { REQUIRED_BY_STEP, STEPS, type OnboardingAnswers, type OnboardingProgress } from './steps';

/**
 * ## Resumable by construction
 *
 * Progress is persisted server-side after every step, not held in component
 * state and not in `sessionStorage`. The verification for ENG-30 is "interrupt
 * mid-wizard, reload, resume at the same step" — and an engineer being
 * interrupted mid-task is the normal case on a factory floor, not an edge one.
 *
 * The consequence is that the *server* owns which step you are on. This
 * component reads it, and never assumes step zero.
 */
export function OnboardingWizard({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, status } = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => authFetch<OnboardingProgress>('/onboarding'),
    // Always refetched on mount: the whole point is that another tab or an
    // earlier session may have moved this forward.
    staleTime: 0,
  });

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [resumed, setResumed] = useState(false);
  const hydrated = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (data === undefined || hydrated.current) return;
    hydrated.current = true;
    setIndex(Math.min(data.current_step, STEPS.length - 1));
    setAnswers(data.answers);
    setResumed(data.current_step > 0);
    if (data.completed_at !== null) router.replace(surfacePath('dashboard', locale));
  }, [data, router, locale]);

  const save = useMutation({
    mutationFn: (next: { current_step: number; answers: OnboardingAnswers }) =>
      authFetch<OnboardingProgress>('/onboarding', { method: 'PUT', body: next }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['onboarding'], saved);
    },
  });

  const complete = useMutation({
    mutationFn: () => authFetch<OnboardingProgress>('/onboarding/complete', { method: 'POST' }),
    onSuccess: () => router.push(surfacePath('dashboard', locale)),
  });

  const step = STEPS[index] ?? 'role';
  const missing = REQUIRED_BY_STEP[step].filter((key) => !answers[key]);

  const set = (key: keyof OnboardingAnswers, value: string): void => {
    setAnswers((previous) => ({ ...previous, [key]: value }));
  };

  const goTo = (next: number): void => {
    setIndex(next);
    save.mutate({ current_step: next, answers });
    // Moving focus to the new step's heading is what makes the wizard usable
    // with a screen reader — without it, focus stays on a button that no longer
    // exists and the reader announces nothing at all.
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  return (
    <DataState
      status={status === 'pending' ? 'loading' : status === 'error' ? 'error' : 'ready'}
      loadingLabel={t.common.loading}
    >
      <div className="mx-auto max-w-lg">
        <p className="text-text-muted text-[length:var(--type-ui-size-sm)]">
          {t.onboarding.stepOf
            .replace('{current}', String(index + 1))
            .replace('{total}', String(STEPS.length))}
        </p>

        {/* A real progress element, so assistive technology gets the position
            without a hand-rolled ARIA widget. */}
        <progress
          value={index + 1}
          max={STEPS.length}
          className="mt-2 h-1 w-full"
          aria-label={t.onboarding.title}
        />

        {resumed ? (
          <div className="mt-6">
            <Alert tone="info" announce title={t.onboarding.resumeNotice} />
          </div>
        ) : null}

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-8 font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] [font-stretch:125%]"
        >
          {t.onboarding.steps[step].title}
        </h1>
        <p className="text-text-muted mt-2">{t.onboarding.steps[step].body}</p>

        <div className="mt-10 flex flex-col gap-6">
          {step === 'role' ? (
            <Field label={t.onboarding.steps.role.label} required>
              {(control) => (
                <select
                  {...control}
                  value={answers.role ?? ''}
                  onChange={(event) => {
                    set('role', event.target.value);
                  }}
                  className="border-border-default bg-surface-base rounded-chamfer border px-3 py-2"
                >
                  <option value="" disabled>
                    —
                  </option>
                  {Object.entries(t.onboarding.steps.role.options).map(([value, label]) => (
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
                label={t.onboarding.steps.plant.nameLabel}
                value={answers.plant_name ?? ''}
                onChange={(event) => {
                  set('plant_name', event.target.value);
                }}
                required
              />
              <TextField
                label={t.onboarding.steps.plant.countryLabel}
                value={answers.plant_country ?? ''}
                onChange={(event) => {
                  set('plant_country', event.target.value);
                }}
                autoComplete="country-name"
                required
              />
            </>
          ) : null}

          {step === 'line' ? (
            <>
              <TextField
                label={t.onboarding.steps.line.nameLabel}
                value={answers.line_name ?? ''}
                onChange={(event) => {
                  set('line_name', event.target.value);
                }}
                required
              />
              <Field label={t.onboarding.steps.line.kindLabel} required>
                {(control) => (
                  <select
                    {...control}
                    value={answers.line_kind ?? ''}
                    onChange={(event) => {
                      set('line_kind', event.target.value);
                    }}
                    className="border-border-default bg-surface-base rounded-chamfer border px-3 py-2"
                  >
                    <option value="" disabled>
                      —
                    </option>
                    <option value="pilot">{t.onboarding.steps.line.kindPilot}</option>
                    <option value="production">{t.onboarding.steps.line.kindProduction}</option>
                  </select>
                )}
              </Field>
              <Field label={t.onboarding.steps.line.formatLabel} required>
                {(control) => (
                  <select
                    {...control}
                    value={answers.cell_format ?? ''}
                    onChange={(event) => {
                      set('cell_format', event.target.value);
                    }}
                    className="border-border-default bg-surface-base rounded-chamfer border px-3 py-2"
                  >
                    <option value="" disabled>
                      —
                    </option>
                    <option value="pouch">{t.onboarding.steps.line.formatPouch}</option>
                    <option value="prismatic">{t.onboarding.steps.line.formatPrismatic}</option>
                    <option value="cylindrical">{t.onboarding.steps.line.formatCylindrical}</option>
                  </select>
                )}
              </Field>
            </>
          ) : null}
        </div>

        <div className="mt-10 flex items-center gap-3">
          {index > 0 ? (
            <Button
              variant="secondary"
              onClick={() => {
                goTo(index - 1);
              }}
            >
              {t.onboarding.back}
            </Button>
          ) : null}

          {index < STEPS.length - 1 ? (
            <Button
              disabled={missing.length > 0}
              onClick={() => {
                goTo(index + 1);
              }}
            >
              {t.onboarding.next}
            </Button>
          ) : (
            <Button
              disabled={missing.length > 0}
              loading={complete.isPending}
              loadingLabel={t.onboarding.finishing}
              onClick={() => {
                save.mutate({ current_step: index, answers });
                complete.mutate();
              }}
            >
              {t.onboarding.finish}
            </Button>
          )}
        </div>
      </div>
    </DataState>
  );
}
