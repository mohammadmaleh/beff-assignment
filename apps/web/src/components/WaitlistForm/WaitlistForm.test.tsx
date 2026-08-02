import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockFetch, problemResponse, requestsOf, type Stub } from '@/test/fetchMock';

import { WaitlistForm } from './WaitlistForm';

const mockWaitlist = (stub: Stub) => mockFetch({ '/waitlist': stub });

/** Fill both fields and submit, in whichever locale is on screen. */
const submit = async (labels: {
  email: RegExp | string;
  company: RegExp | string;
  cta: string;
}) => {
  await userEvent.type(screen.getByLabelText(labels.email), 'ada@beff.example');
  await userEvent.type(screen.getByLabelText(labels.company), 'Zellwerk Süd GmbH');
  await userEvent.click(screen.getByRole('button', { name: labels.cta }));
};

const EN = { email: /work email/i, company: /company/i, cta: 'Request access' };
const DE = { email: /E-Mail/i, company: /^Unternehmen/, cta: 'Zugang anfragen' };

describe('WaitlistForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('a successful request', () => {
    it('replaces the form with a confirmation rather than leaving it filled in', async () => {
      mockWaitlist({ status: 201, body: { status: 'received' } });
      render(<WaitlistForm locale="en" />);
      await submit(EN);

      expect(await screen.findByText('Request received')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Request access' })).not.toBeInTheDocument();
    });

    it('sends what the fields hold, as JSON', async () => {
      const fetchMock = mockWaitlist({ status: 201, body: { status: 'received' } });
      render(<WaitlistForm locale="en" />);
      await submit(EN);
      await screen.findByText('Request received');

      const [request] = requestsOf(fetchMock);
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/api/v1/waitlist');
      expect(JSON.parse(request?.body ?? '{}')).toEqual({
        email: 'ada@beff.example',
        company: 'Zellwerk Süd GmbH',
      });
    });

    it('tells the API which language the reader is in', async () => {
      // The backend renders its Problem Details from stable codes, but
      // `Accept-Language` is what lets anything it *does* phrase come back in
      // the right language.
      const fetchMock = mockWaitlist({ status: 201, body: { status: 'received' } });
      render(<WaitlistForm locale="de" />);
      await submit(DE);
      await screen.findByText('Anfrage eingegangen');

      expect(requestsOf(fetchMock)[0]?.headers['accept-language']).toBe('de');
    });

    it('announces the wait while the request is in flight', async () => {
      let release: (value: Response) => void = () => undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise<Response>((resolve) => {
              release = resolve;
            }),
        ),
      );
      render(<WaitlistForm locale="en" />);
      await submit(EN);

      expect(screen.getByRole('button', { name: /sending your request/i })).toHaveAttribute(
        'aria-busy',
        'true',
      );
      release({ ok: true, status: 201 } as Response);
    });
  });

  describe('failure', () => {
    it('puts a server-sourced validation message on the field it belongs to', async () => {
      mockWaitlist(problemResponse(422, [{ field: 'email', code: 'already_registered' }]));
      render(<WaitlistForm locale="en" />);
      await submit(EN);

      const message = await screen.findByRole('alert');
      expect(message).toHaveTextContent('That address is already on the list.');
      expect(screen.getByLabelText(/work email/i)).toHaveAttribute('aria-invalid', 'true');
    });

    it('translates the code rather than showing the API’s English', async () => {
      mockWaitlist(problemResponse(422, [{ field: 'email', code: 'invalid_email' }]));
      render(<WaitlistForm locale="de" />);
      await submit(DE);

      expect(
        await screen.findByText('Das sieht nicht nach einer E-Mail-Adresse aus.'),
      ).toBeInTheDocument();
    });

    it('keeps the form usable after a validation failure', async () => {
      mockWaitlist(problemResponse(422, [{ field: 'email', code: 'invalid_email' }]));
      render(<WaitlistForm locale="en" />);
      await submit(EN);
      await screen.findByRole('alert');

      const button = screen.getByRole('button', { name: 'Request access' });
      expect(button).not.toHaveAttribute('aria-busy');
      expect(screen.getByLabelText(/work email/i)).toHaveValue('ada@beff.example');
    });

    it('does not tell the user to check their input when the failure was ours', async () => {
      // A 502 from a proxy is not a validation failure, and "check your email
      // address" sends someone hunting for a mistake they did not make.
      mockWaitlist({ status: 502, contentType: 'text/html', body: '<html>bad gateway</html>' });
      render(<WaitlistForm locale="en" />);
      await submit(EN);

      expect(await screen.findByText(/something went wrong on our side/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/work email/i)).not.toHaveAttribute('aria-invalid');
    });

    it('reports a dropped connection as a failure, not as bad input', async () => {
      mockWaitlist({ networkError: true });
      render(<WaitlistForm locale="en" />);
      await submit(EN);

      expect(await screen.findByText('That did not send')).toBeInTheDocument();
    });

    it('clears a stale field error when the form is submitted again', async () => {
      const fetchMock = mockFetch({
        '/waitlist': (() => {
          let first = true;
          return () => {
            if (first) {
              first = false;
              return problemResponse(422, [{ field: 'email', code: 'invalid_email' }]);
            }
            return { status: 201, body: { status: 'received' } };
          };
        })(),
      });
      render(<WaitlistForm locale="en" />);
      await submit(EN);
      await screen.findByRole('alert');

      await userEvent.click(screen.getByRole('button', { name: 'Request access' }));

      expect(await screen.findByText('Request received')).toBeInTheDocument();
      expect(requestsOf(fetchMock)).toHaveLength(2);
    });
  });

  it('hands validation to the server rather than to the browser bubble', () => {
    // Only the server knows whether an address is already on the list, and the
    // browser's own bubble cannot be styled, cannot be translated, and
    // disappears on blur.
    const { container } = render(<WaitlistForm locale="en" />);
    expect(container.querySelector('form')).toHaveAttribute('novalidate');
  });

  it('describes the email field persistently rather than in a placeholder', async () => {
    render(<WaitlistForm locale="en" />);

    await waitFor(() => {
      expect(screen.getByLabelText(/work email/i)).toHaveAccessibleDescription(
        'We use this to contact you about access. Nothing else.',
      );
    });
    expect(screen.getByLabelText(/work email/i)).not.toHaveAttribute('placeholder');
  });
});
