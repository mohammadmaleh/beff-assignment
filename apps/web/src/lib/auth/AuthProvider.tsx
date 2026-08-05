'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { AUTH_ROUTES } from '@/constants/api';

import { authFetch, refresh, setAccessToken } from './session';

export interface SessionUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
}

interface SessionResponse {
  access_token: string;
  expires_in: number;
  user: SessionUser;
}

export interface AuthState {
  user: SessionUser | null;
  /** True until the first refresh attempt settles. Distinct from "signed out". */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Session state for the authenticated surface.
 *
 * Auth is owned end to end by FastAPI (decision #3 in the roadmap), which makes
 * every authenticated screen client-rendered: the refresh token rotates on
 * every use, and redeeming it during SSR would burn it on a request whose
 * response the browser may never receive.
 *
 * `loading` exists so a signed-in user does not see the signed-out UI flash
 * before the refresh lands. Treating "no user yet" as "signed out" is how a
 * dashboard bounces its own user to the login page on every reload.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async (): Promise<void> => {
      const ok = await refresh();
      if (cancelled) return;
      if (!ok) {
        setLoading(false);
        return;
      }
      try {
        setUser(await authFetch<SessionUser>(AUTH_ROUTES.me));
      } catch {
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback((session: SessionResponse): void => {
    setAccessToken(session.access_token);
    setUser(session.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      start(
        await authFetch<SessionResponse>(AUTH_ROUTES.login, {
          method: 'POST',
          body: { email, password },
        }),
      );
    },
    [start],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string): Promise<void> => {
      start(
        await authFetch<SessionResponse>(AUTH_ROUTES.register, {
          method: 'POST',
          body: { email, password, display_name: displayName },
        }),
      );
    },
    [start],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authFetch<void>(AUTH_ROUTES.logout, { method: 'POST', retry: false });
    } catch {
      // Swallowed, not re-thrown. `finally` alone still rejects the promise the
      // caller is holding — so `logout().then(() => router.replace(...))` skips
      // its redirect on a 401 or a dropped connection, and the browser logs an
      // unhandled rejection, for a call that *did* what the caller asked. The
      // server-side revoke is best-effort by design; there is nothing a caller
      // can do about it, and every call site would otherwise need this catch.
    } finally {
      // Local state clears whatever the server said. A logout that appears to
      // fail and leaves the user looking signed in is worse than one that
      // clears optimistically.
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
