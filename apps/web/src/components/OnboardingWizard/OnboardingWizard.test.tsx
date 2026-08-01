import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockFetchJson, requestsOf } from '@/test/fetchMock';
import { renderWithProviders } from '@/test/renderWithProviders';

import { OnboardingWizard } from './OnboardingWizard';

const replace = vi.fn();
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
}));

const STEPS = ['role', 'plant', 'lines', 'units', 'review'];

const progress = (overrides: Record<string, unknown> = {}) => ({
  current_step: 'role',
  answers: {},
  completed_at: null,
  steps: STEPS,
  missing: ['role'],
  ...overrides,
});

/** Answers every request with the same document, and records what was sent. */
const mockApi = (body: unknown) => mockFetchJson({ '/onboarding': body });

describe('OnboardingWizard', () => {
  beforeEach(() => {
    replace.mockClear();
    push.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts a new user at the first step', async () => {
    mockApi(progress());
    renderWithProviders(<OnboardingWizard locale="en" />);

    expect(await screen.findByRole('heading', { name: 'What do you do?' })).toBeInTheDocument();
  });

  it('resumes at the step the server says, not at the beginning', async () => {
    // **The ENG-30 verification at the component level.** The server owns the
    // position; a client that trusted its own state would restart the wizard
    // on a different device.
    mockApi(
      progress({
        current_step: 'lines',
        answers: { role: 'process_engineer', plant_name: 'Werk Süd', plant_country: 'DE' },
        missing: ['line_name'],
      }),
    );
    renderWithProviders(<OnboardingWizard locale="en" />);

    expect(await screen.findByRole('heading', { name: 'Which line?' })).toBeInTheDocument();
    expect(screen.getByText('Picked up where you left off.')).toBeInTheDocument();
  });

  it('does not claim to have resumed a wizard that never started', async () => {
    mockApi(progress());
    renderWithProviders(<OnboardingWizard locale="en" />);

    await screen.findByRole('heading', { name: 'What do you do?' });
    expect(screen.queryByText('Picked up where you left off.')).not.toBeInTheDocument();
  });

  it('reports the position with a real progress element', async () => {
    mockApi(progress({ current_step: 'units', missing: [] }));
    renderWithProviders(<OnboardingWizard locale="en" />);

    const bar = await screen.findByRole('progressbar');
    expect(bar).toHaveAttribute('value', '4');
    expect(bar).toHaveAttribute('max', '5');
  });

  it('will not continue until the step is answered', async () => {
    mockApi(progress());
    renderWithProviders(<OnboardingWizard locale="en" />);

    expect(await screen.findByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('advances once the step is answered, and saves', async () => {
    const fetchMock = mockApi(progress());
    renderWithProviders(<OnboardingWizard locale="en" />);

    await userEvent.selectOptions(await screen.findByRole('combobox'), 'process_engineer');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Where is the line?' })).toBeInTheDocument();
    await waitFor(() => {
      const saved = requestsOf(fetchMock).find((request) => request.method === 'PUT');
      expect(saved).toBeDefined();
      expect(saved?.body).toContain('"current_step":"plant"');
    });
  });

  it('moves focus to the new step so a screen reader is told the page changed', async () => {
    // Without this, focus stays on a button that no longer exists and nothing
    // is announced — the page silently changes underneath the user.
    mockApi(progress());
    renderWithProviders(<OnboardingWizard locale="en" />);

    await userEvent.selectOptions(await screen.findByRole('combobox'), 'other');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const heading = await screen.findByRole('heading', { name: 'Where is the line?' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });

  it('offers a review of every answer before finishing', async () => {
    mockApi(
      progress({
        current_step: 'review',
        answers: {
          role: 'process_engineer',
          plant_name: 'Werk Süd',
          plant_country: 'DE',
          line_name: 'Pilotlinie 1',
          line_kind: 'pilot',
          cell_format: 'pouch',
          unit_system: 'metric',
        },
        missing: [],
      }),
    );
    renderWithProviders(<OnboardingWizard locale="en" />);

    expect(await screen.findByText('Werk Süd')).toBeInTheDocument();
    expect(screen.getByText('Pilotlinie 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish setup' })).toBeEnabled();
  });

  it('refuses to finish while the server still reports missing answers', async () => {
    mockApi(progress({ current_step: 'review', missing: ['plant_name'] }));
    renderWithProviders(<OnboardingWizard locale="en" />);

    expect(await screen.findByRole('button', { name: 'Finish setup' })).toBeDisabled();
  });

  it('sends an already-finished user straight to the dashboard', async () => {
    mockApi(progress({ completed_at: '2026-07-31T12:00:00Z', missing: [] }));
    renderWithProviders(<OnboardingWizard locale="en" />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en/dashboard');
    });
  });

  it('renders in German when the locale is German', async () => {
    mockApi(progress());
    renderWithProviders(<OnboardingWizard locale="de" />);

    expect(await screen.findByRole('heading', { name: 'Was ist Ihre Rolle?' })).toBeInTheDocument();
  });
});
