import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockFetchJson, requestsOf, sawRequest } from '@/test/fetchMock';
import { renderWithProviders } from '@/test/renderWithProviders';

import { ProfileView } from './ProfileView';

const replace = vi.fn();
const logout = vi.fn().mockResolvedValue(undefined);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    useAuth: () => ({
      user: {
        id: 'u1',
        email: 'ada@beff.example',
        display_name: 'Ada Lovelace',
        role: 'member',
        created_at: '2026-01-01T00:00:00Z',
        email_verified_at: '2026-01-01T00:00:00Z',
      },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout,
    }),
  };
});

const mockApi = mockFetchJson;

describe('ProfileView', () => {
  beforeEach(() => {
    replace.mockClear();
    logout.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the account details', async () => {
    mockApi({
      '/privacy/consent': { analytics: false, marketing: false },
      '/privacy/export': null,
    });
    renderWithProviders(<ProfileView locale="en" />);

    expect(await screen.findByText('ada@beff.example')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('reflects current consent, unchecked by default', async () => {
    mockApi({
      '/privacy/consent': { analytics: false, marketing: false },
      '/privacy/export': null,
    });
    renderWithProviders(<ProfileView locale="en" />);

    const analytics = await screen.findByRole('checkbox', { name: 'Analytics cookies' });
    expect(analytics).not.toBeChecked();
  });

  it('POSTs consent rather than PUTting it', async () => {
    // The verb is part of the design: this appends an event, it does not edit a
    // value. A PUT would suggest the previous state can be overwritten, which
    // is exactly what Art. 7(1) forbids.
    // Starts unchecked, so the click is a *grant*. Seeding this as `true` would
    // make the click a withdrawal and the assertion below pass for the opposite
    // reason.
    const fetchMock = mockApi({
      '/privacy/consent': { analytics: false, marketing: false },
      '/privacy/export': null,
    });
    renderWithProviders(<ProfileView locale="en" />);

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Analytics cookies' }));

    await waitFor(() => {
      const call = requestsOf(fetchMock).find(
        (request) => request.method === 'POST' && request.url.includes('/privacy/consent'),
      );
      expect(call).toBeDefined();
      expect(call?.body).toContain('"granted":true');
    });
  });

  it('explains why the history is kept', async () => {
    mockApi({
      '/privacy/consent': { analytics: false, marketing: false },
      '/privacy/export': null,
    });
    renderWithProviders(<ProfileView locale="en" />);

    expect(await screen.findByText(/append-only/)).toBeInTheDocument();
  });

  it('announces that an export is being prepared', async () => {
    mockApi({
      '/privacy/consent': { analytics: false, marketing: false },
      '/privacy/export': {
        id: 'e1',
        status: 'pending',
        requested_at: '2026-07-31T12:00:00Z',
        completed_at: null,
        download_path: null,
      },
    });
    renderWithProviders(<ProfileView locale="en" />);

    expect(await screen.findByText(/Preparing your export/)).toBeInTheDocument();
  });

  it('offers the download once the export is ready', async () => {
    mockApi({
      '/privacy/consent': { analytics: false, marketing: false },
      '/privacy/export': {
        id: 'e1',
        status: 'ready',
        requested_at: '2026-07-31T12:00:00Z',
        completed_at: '2026-07-31T12:00:05Z',
        download_path: '/privacy/export/e1/download',
      },
    });
    renderWithProviders(<ProfileView locale="en" />);

    const link = await screen.findByRole('link', { name: 'Download' });
    expect(link).toHaveAttribute('href', expect.stringContaining('/privacy/export/e1/download'));
  });

  it('says a failed export can safely be requested again', async () => {
    mockApi({
      '/privacy/consent': { analytics: false, marketing: false },
      '/privacy/export': {
        id: 'e1',
        status: 'failed',
        requested_at: '2026-07-31T12:00:00Z',
        completed_at: '2026-07-31T12:00:05Z',
        download_path: null,
      },
    });
    renderWithProviders(<ProfileView locale="en" />);

    expect(await screen.findByText(/failed to build/)).toBeInTheDocument();
  });

  it('refuses to erase the account without the typed confirmation', async () => {
    // A modal is dismissed by muscle memory; typing a word cannot be.
    const fetchMock = mockApi({
      '/privacy/consent': { analytics: false, marketing: false },
      '/privacy/export': null,
    });
    renderWithProviders(<ProfileView locale="en" />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete my account permanently' }),
    );

    expect(await screen.findByText('Type DELETE exactly to confirm.')).toBeInTheDocument();
    expect(sawRequest(fetchMock, 'DELETE', '/privacy/erasure')).toBe(false);
  });

  it('refuses a near-miss confirmation', async () => {
    const fetchMock = mockApi({
      '/privacy/consent': { analytics: false, marketing: false },
      '/privacy/export': null,
    });
    renderWithProviders(<ProfileView locale="en" />);

    await userEvent.type(await screen.findByLabelText('Type DELETE to confirm'), 'delete');
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account permanently' }));

    expect(await screen.findByText('Type DELETE exactly to confirm.')).toBeInTheDocument();
    expect(sawRequest(fetchMock, 'DELETE', '/privacy/erasure')).toBe(false);
  });

  it('erases, signs out and leaves when the confirmation matches', async () => {
    const fetchMock = mockApi({
      '/privacy/consent': { analytics: false, marketing: false },
      '/privacy/export': null,
      '/privacy/erasure': null,
    });
    renderWithProviders(<ProfileView locale="en" />);

    await userEvent.type(await screen.findByLabelText('Type DELETE to confirm'), 'DELETE');
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account permanently' }));

    await waitFor(() => {
      expect(sawRequest(fetchMock, 'DELETE', '/privacy/erasure')).toBe(true);
    });
    // Signed out locally and taken away from a page that no longer has an
    // account behind it.
    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith('/en');
    });
  });

  it('names the articles each control satisfies', async () => {
    // A data subject who can see that a control *is* their Art. 17 right uses
    // it here rather than by writing to a supervisory authority.
    mockApi({
      '/privacy/consent': { analytics: false, marketing: false },
      '/privacy/export': null,
    });
    renderWithProviders(<ProfileView locale="en" />);

    expect(await screen.findByText(/Art\. 15 and Art\. 20/)).toBeInTheDocument();
    expect(screen.getByText(/Art\. 17/)).toBeInTheDocument();
  });

  it('renders in German when the locale is German', async () => {
    mockApi({
      '/privacy/consent': { analytics: false, marketing: false },
      '/privacy/export': null,
    });
    renderWithProviders(<ProfileView locale="de" />);

    expect(await screen.findByText('Ihr Konto')).toBeInTheDocument();
    expect(screen.getByText('Konto löschen')).toBeInTheDocument();
  });
});
