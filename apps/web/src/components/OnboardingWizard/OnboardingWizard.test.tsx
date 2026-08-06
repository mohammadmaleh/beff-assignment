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
    // is announced - the page silently changes underneath the user.
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
    // The country comes back from the server as `DE` and is read back as a
    // country. Echoing the code would ask the user to confirm a translation
    // they never made - they picked `Germany` from a list.
    expect(screen.getByText('Germany')).toBeInTheDocument();
    expect(screen.queryByText('DE')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish setup' })).toBeEnabled();
  });

  it('reads the stored country back in the page’s language', async () => {
    mockApi(
      progress({
        current_step: 'review',
        answers: { plant_country: 'DE' },
        missing: [],
      }),
    );
    renderWithProviders(<OnboardingWizard locale="de" />);

    expect(await screen.findByText('Deutschland')).toBeInTheDocument();
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

  // ───────────────────────────────────────────────────────────────────────────
  // The middle of the wizard.
  //
  // The tests above enter at `role` and at `review`, which between them leave
  // every field on the three steps in between - and the back button - never
  // rendered. That is not a coverage detail: `plant`, `lines` and `units` are
  // where the wizard actually collects anything, and a control whose `onChange`
  // has never run is a control nobody has checked is wired to the right key.
  // ───────────────────────────────────────────────────────────────────────────

  it('collects the plant and hands both fields to the server under their own keys', async () => {
    // A field wired to the wrong key is invisible on screen - the value appears
    // in the input the user typed into either way - and shows up as a plant
    // named "DE" once the answers reach the API.
    const fetchMock = mockApi(progress({ current_step: 'plant', answers: { role: 'other' } }));
    renderWithProviders(<OnboardingWizard locale="en" />);

    await userEvent.type(await screen.findByLabelText(/^Plant name/), 'Werk Süd');
    /*
     * Picked by name, stored as a code. The country field is a combobox now,
     * not a two-character text box, so this is also the assertion that the
     * translation happens - `plants.country_code` has a CHECK constraint that
     * `Germany` would fail.
     *
     * `getByRole` rather than `getByLabelText`: the field's label names the
     * input *and* the listbox, deliberately, so the label matches two elements.
     */
    await userEvent.type(screen.getByRole('combobox', { name: /^Country/ }), 'Germ');
    await userEvent.click(screen.getByRole('option', { name: /Germany/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      const saved = requestsOf(fetchMock).find((request) => request.method === 'PUT');
      expect(saved?.body).toContain('"plant_name":"Werk Süd"');
      expect(saved?.body).toContain('"plant_country":"DE"');
    });
  });

  it('will not continue from the plant step on a name alone', async () => {
    mockApi(progress({ current_step: 'plant', answers: { role: 'other' } }));
    renderWithProviders(<OnboardingWizard locale="en" />);

    await userEvent.type(await screen.findByLabelText(/^Plant name/), 'Werk Süd');

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('treats whitespace as an unanswered field', async () => {
    // `!answers[key]?.trim()` - otherwise a space satisfies the client check and
    // the server rejects the step with a `name_not_blank` violation, which
    // reaches the user as a validation error on a field that looks filled in.
    mockApi(progress({ current_step: 'lines', answers: { role: 'other' } }));
    renderWithProviders(<OnboardingWizard locale="en" />);

    await userEvent.type(await screen.findByLabelText(/^Line name/), '   ');

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('collects the line, its kind and its cell format', async () => {
    const fetchMock = mockApi(progress({ current_step: 'lines', answers: { role: 'other' } }));
    renderWithProviders(<OnboardingWizard locale="en" />);

    await userEvent.type(await screen.findByLabelText(/^Line name/), 'Pilotlinie 1');
    await userEvent.selectOptions(screen.getByLabelText(/^Line type/), 'pilot');
    await userEvent.selectOptions(screen.getByLabelText(/^Cell format/), 'pouch');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      const saved = requestsOf(fetchMock).find((request) => request.method === 'PUT');
      expect(saved?.body).toContain('"line_name":"Pilotlinie 1"');
      expect(saved?.body).toContain('"line_kind":"pilot"');
      expect(saved?.body).toContain('"cell_format":"pouch"');
    });
  });

  it('offers every cell format the API accepts', async () => {
    // The three values are a CHECK constraint on `lines.cell_format`. A select
    // offering a fourth would fail at the database, one step later and with a
    // message about a constraint rather than about the choice.
    mockApi(progress({ current_step: 'lines', answers: { role: 'other' } }));
    renderWithProviders(<OnboardingWizard locale="en" />);

    const select = await screen.findByLabelText(/^Cell format/);
    expect(
      [...select.querySelectorAll('option')].map((option) => option.value).filter(Boolean),
    ).toEqual(['pouch', 'prismatic', 'cylindrical']);
  });

  it('collects the unit system', async () => {
    const fetchMock = mockApi(progress({ current_step: 'units', answers: { role: 'other' } }));
    renderWithProviders(<OnboardingWizard locale="en" />);

    // Anchored on the heading first: the wizard renders `role` for one commit
    // before hydration moves it, so a bare `findByRole('combobox')` resolves
    // against the *role* select and picks an option this step does not have.
    await screen.findByRole('heading', { name: 'Which units?' });
    await userEvent.selectOptions(screen.getByLabelText(/^Unit system/), 'imperial');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      const saved = requestsOf(fetchMock).find((request) => request.method === 'PUT');
      expect(saved?.body).toContain('"unit_system":"imperial"');
    });
  });

  it('goes back a step, keeping what was already answered', async () => {
    // Going back and losing the answers is the same to a user as the wizard
    // crashing, and it is the reason people abandon setup flows.
    mockApi(
      progress({
        current_step: 'plant',
        answers: { role: 'other', plant_name: 'Werk Süd' },
      }),
    );
    renderWithProviders(<OnboardingWizard locale="en" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Back' }));

    expect(await screen.findByRole('heading', { name: 'What do you do?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByLabelText(/^Plant name/)).toHaveValue('Werk Süd');
  });

  it('offers no way back from the first step', async () => {
    mockApi(progress());
    renderWithProviders(<OnboardingWizard locale="en" />);

    await screen.findByRole('heading', { name: 'What do you do?' });
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('falls back to the first step when the server names one it does not know', async () => {
    // The server could be ahead of this deployment. Trusting the string would
    // put `STEPS.indexOf` at -1, and the wizard would render a step with no
    // fields and no way forward - a dead end rather than a degraded experience.
    mockApi(progress({ current_step: 'quantum_alignment', answers: {} }));
    renderWithProviders(<OnboardingWizard locale="en" />);

    expect(await screen.findByRole('heading', { name: 'What do you do?' })).toBeInTheDocument();
  });

  it('shows the review with a dash where an answer is missing', async () => {
    mockApi(
      progress({
        current_step: 'review',
        answers: { role: 'other' },
        missing: ['plant_name'],
      }),
    );
    renderWithProviders(<OnboardingWizard locale="en" />);

    await screen.findByRole('button', { name: 'Finish setup' });
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  it('sends the user to the dashboard once setup is finished', async () => {
    mockApi(progress({ current_step: 'review', missing: [] }));
    renderWithProviders(<OnboardingWizard locale="en" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Finish setup' }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/en/dashboard');
    });
  });
});
