import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, type AuthState } from '@/lib/auth';

import { AuthForm } from './AuthForm';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const login = vi.fn<AuthState['login']>();
const register = vi.fn<AuthState['register']>();

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    useAuth: () => ({ user: null, loading: false, login, register, logout: vi.fn() }),
  };
});

/** Fill and submit, the way a user does — the form reads `FormData`, not state. */
const submitLogin = async (email = 'ada@beff.example', password = 'a-long-enough-password') => {
  await userEvent.type(screen.getByLabelText(/work email/i), email);
  await userEvent.type(screen.getByLabelText(/^password/i), password);
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
};

/** The same, with the one extra field registration asks for. */
const submitRegister = async (email = 'ada@beff.example', password = 'a-long-enough-password') => {
  await userEvent.type(screen.getByLabelText(/^Name/), 'Ada Lovelace');
  await userEvent.type(screen.getByLabelText(/work email/i), email);
  await userEvent.type(screen.getByLabelText(/^password/i), password);
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
};

describe('AuthForm', () => {
  beforeEach(() => {
    push.mockClear();
    login.mockReset().mockResolvedValue(undefined);
    register.mockReset().mockResolvedValue(undefined);
  });

  describe('the two modes are one form', () => {
    it('asks for a name only when registering', () => {
      const { unmount } = render(<AuthForm mode="login" locale="en" />);
      expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
      unmount();

      render(<AuthForm mode="register" locale="en" />);
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });

    it('tells the password manager which of the two this is', () => {
      // `current-password` offers a saved entry; `new-password` generates one.
      // Getting it wrong is a silent daily papercut.
      const { unmount } = render(<AuthForm mode="login" locale="en" />);
      expect(screen.getByLabelText(/^password/i)).toHaveAttribute(
        'autocomplete',
        'current-password',
      );
      unmount();

      render(<AuthForm mode="register" locale="en" />);
      expect(screen.getByLabelText(/^password/i)).toHaveAttribute('autocomplete', 'new-password');
    });

    it('shows the length requirement before the server rejects it, on register only', () => {
      const { unmount } = render(<AuthForm mode="login" locale="en" />);
      expect(screen.queryByText(/at least 12 characters/i)).not.toBeInTheDocument();
      unmount();

      render(<AuthForm mode="register" locale="en" />);
      expect(screen.getByText(/at least 12 characters/i)).toBeInTheDocument();
    });
  });

  describe('a successful submission', () => {
    it('logs in and goes to the dashboard', async () => {
      render(<AuthForm mode="login" locale="en" />);
      await submitLogin();

      expect(login).toHaveBeenCalledWith('ada@beff.example', 'a-long-enough-password');
      await waitFor(() => {
        expect(push).toHaveBeenCalledWith('/en/dashboard');
      });
    });

    it('sends a new account straight to onboarding, not to an empty dashboard', async () => {
      // An account with no plant and no line cannot render a dashboard, and
      // bouncing off an empty one teaches the user the product is broken.
      render(<AuthForm mode="register" locale="de" />);

      await userEvent.type(screen.getByLabelText(/^Name/), 'Ada Lovelace');
      await userEvent.type(screen.getByLabelText(/E-Mail/i), 'ada@beff.example');
      await userEvent.type(screen.getByLabelText(/^Passwort/), 'a-long-enough-password');
      await userEvent.click(screen.getByRole('button', { name: 'Konto anlegen' }));

      expect(register).toHaveBeenCalledWith(
        'ada@beff.example',
        'a-long-enough-password',
        'Ada Lovelace',
      );
      await waitFor(() => {
        expect(push).toHaveBeenCalledWith('/de/onboarding');
      });
    });

    it('announces the wait while the request is in flight', async () => {
      let release: () => void = () => undefined;
      login.mockReturnValue(
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      );
      render(<AuthForm mode="login" locale="en" />);
      await submitLogin();

      const button = screen.getByRole('button', { name: /logging you in/i });
      expect(button).toHaveAttribute('aria-busy', 'true');
      release();
    });
  });

  describe('failure', () => {
    it('never says which of the email and the password was wrong', async () => {
      // A form that distinguishes them is an account enumeration oracle.
      login.mockRejectedValue(new ApiError(401));
      render(<AuthForm mode="login" locale="en" />);
      await submitLogin();

      expect(
        await screen.findByText('That email and password do not match an account.'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/work email/i)).not.toHaveAttribute('aria-invalid');
      expect(screen.getByLabelText(/^password/i)).not.toHaveAttribute('aria-invalid');
    });

    it('does not blame the credentials for a server fault', async () => {
      login.mockRejectedValue(new ApiError(500));
      render(<AuthForm mode="login" locale="en" />);
      await submitLogin();

      expect(await screen.findByText(/something went wrong on our side/i)).toBeInTheDocument();
      expect(
        screen.queryByText('That email and password do not match an account.'),
      ).not.toBeInTheDocument();
    });

    it('says the address is taken, rather than blaming the server', async () => {
      // The API distinguishes this from every other failure with a stable code
      // and always has. Collapsing it into "something went wrong on our side"
      // tells someone whose only mistake was already having an account to try
      // again — which cannot ever work.
      register.mockRejectedValue(new ApiError(409, {}, 'auth.email_already_registered'));
      render(<AuthForm mode="register" locale="en" />);
      await submitRegister();

      expect(await screen.findByText(/already has an account/i)).toBeInTheDocument();
      expect(screen.queryByText(/something went wrong on our side/i)).not.toBeInTheDocument();
    });

    it('says it in German for a German reader', async () => {
      register.mockRejectedValue(new ApiError(409, {}, 'auth.email_already_registered'));
      render(<AuthForm mode="register" locale="de" />);

      await userEvent.type(screen.getByLabelText(/^Name/), 'Ada Lovelace');
      await userEvent.type(screen.getByLabelText(/E-Mail/i), 'ada@beff.example');
      await userEvent.type(screen.getByLabelText(/^Passwort/), 'a-long-enough-password');
      await userEvent.click(screen.getByRole('button', { name: 'Konto anlegen' }));

      expect(await screen.findByText(/besteht bereits ein Konto/i)).toBeInTheDocument();
    });

    it('tells a rate-limited caller to wait rather than to try again', async () => {
      // Both auth routes carry a limiter. "Please try again" is the one piece
      // of advice guaranteed to make a 429 worse.
      login.mockRejectedValue(new ApiError(429, {}, 'rate_limit_exceeded'));
      render(<AuthForm mode="login" locale="en" />);
      await submitLogin();

      expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
    });

    it('falls back to the generic message for a code this build has never seen', async () => {
      login.mockRejectedValue(new ApiError(500, {}, 'auth.account_suspended'));
      render(<AuthForm mode="login" locale="en" />);
      await submitLogin();

      expect(await screen.findByText(/something went wrong on our side/i)).toBeInTheDocument();
    });

    it('treats a thrown network error as a server fault, not as bad input', async () => {
      login.mockRejectedValue(new TypeError('Failed to fetch'));
      render(<AuthForm mode="login" locale="en" />);
      await submitLogin();

      expect(await screen.findByText(/something went wrong on our side/i)).toBeInTheDocument();
    });

    it('puts a per-field error on the field it belongs to', async () => {
      register.mockRejectedValue(new ApiError(422, { password: 'weak_password' }));
      render(<AuthForm mode="register" locale="en" />);

      await userEvent.type(screen.getByLabelText(/^Name/), 'Ada Lovelace');
      await userEvent.type(screen.getByLabelText(/work email/i), 'ada@beff.example');
      await userEvent.type(screen.getByLabelText(/^password/i), 'short');
      await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

      const message = await screen.findByRole('alert');
      expect(message).toHaveTextContent('Choose a longer password — at least 12 characters.');
      expect(screen.getByLabelText(/^password/i)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(/work email/i)).not.toHaveAttribute('aria-invalid');
    });

    it('renders the server’s error code in the reader’s language', async () => {
      // The API returns a stable code, never an English sentence — which is the
      // whole reason a German user gets a German message from an API that has
      // no idea which locale is on screen.
      login.mockRejectedValue(new ApiError(422, { email: 'invalid_email' }));
      render(<AuthForm mode="login" locale="de" />);

      await userEvent.type(screen.getByLabelText(/E-Mail/i), 'nope');
      await userEvent.type(screen.getByLabelText(/^Passwort/), 'a-long-enough-password');
      await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

      expect(
        await screen.findByText('Das sieht nicht nach einer E-Mail-Adresse aus.'),
      ).toBeInTheDocument();
    });

    it('falls back to a usable message for a code this build has never seen', async () => {
      // A backend that adds a validation rule must not be able to produce a
      // field marked invalid with nothing next to it.
      login.mockRejectedValue(new ApiError(422, { email: 'sanctions_list_hit' }));
      render(<AuthForm mode="login" locale="en" />);
      await submitLogin();

      expect(await screen.findByText('Please check this field.')).toBeInTheDocument();
    });

    it('re-enables the button so a corrected submission is possible', async () => {
      login.mockRejectedValue(new ApiError(401));
      render(<AuthForm mode="login" locale="en" />);
      await submitLogin();

      const button = await screen.findByRole('button', { name: 'Log in' });
      expect(button).not.toHaveAttribute('aria-busy');
    });

    it('clears the previous failure when the form is submitted again', async () => {
      login.mockRejectedValueOnce(new ApiError(401));
      render(<AuthForm mode="login" locale="en" />);
      await submitLogin();
      await screen.findByText('That email and password do not match an account.');

      login.mockResolvedValue(undefined);
      await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

      await waitFor(() => {
        expect(
          screen.queryByText('That email and password do not match an account.'),
        ).not.toBeInTheDocument();
      });
    });
  });

  it('never lets a submit before hydration put the password in the URL', () => {
    // A form with no `method` submits by **GET** to its own URL. The handler
    // that calls `preventDefault` only exists once the bundle has hydrated, so
    // a submit in the window before that navigates to
    // `/en/login?email=…&password=…` — and the password is then in the address
    // bar, in browser history, in the `Referer` of the next request, and in
    // every access log between here and the origin.
    for (const mode of ['login', 'register'] as const) {
      const { container, unmount } = render(<AuthForm mode={mode} locale="en" />);
      expect(container.querySelector('form')).toHaveAttribute('method', 'post');
      unmount();
    }
  });

  it('hands validation to the server rather than to the browser bubble', () => {
    // The browser's own bubble cannot be styled, cannot be translated, and
    // disappears on blur.
    const { container } = render(<AuthForm mode="login" locale="en" />);
    expect(container.querySelector('form')).toHaveAttribute('novalidate');
  });
});
