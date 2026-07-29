# ADR-0003: FastAPI owns authentication; authenticated routes are client-rendered

## Status

Accepted

## Context

With a separate Next.js frontend and FastAPI backend ([ADR-0002](0002-nextjs-and-fastapi.md)),
something has to hold the session. The choice determines how much of Next.js's
server-rendering capability the app can actually use.

## Decision drivers

- The brief names FastAPI as _the backend_. Session logic living in Next would blur that.
- Tokens must not be readable by injected JavaScript.
- A stolen refresh token must be detectable, not merely expirable — this is a
  GDPR-facing product handling commercially sensitive data.
- Session logic in two languages is two places to get it wrong.

## Considered options

### Option 1: FastAPI owns auth end to end

Browser talks directly to FastAPI. Short-lived JWT access token held in memory, plus an
httpOnly `SameSite` refresh cookie with **rotation and reuse detection**.

- **Pros:** one place owns sessions. Honest "the backend is FastAPI" story. Refresh
  token never reachable from JavaScript.
- **Cons:** CORS with credentials. Access token in memory is lost on reload, requiring a
  refresh round-trip on boot. **Authenticated routes cannot be Server Components** — see
  below.

### Option 2: Next.js BFF proxy

Next holds an encrypted session cookie and proxies to FastAPI server-side.

- **Pros:** no token in client JS at all. Authenticated pages can be server-rendered.
- **Cons:** session logic in two languages. An extra network hop. Invites the reviewer's
  question "why is there a Node backend when the brief said FastAPI?"

### Option 3: Long-lived token in a readable cookie

- **Pros:** Server Components can read it directly; simplest to implement.
- **Cons:** readable by any injected script. Directly contradicts the privacy-by-design
  posture the rest of the project argues for.

## Decision

**Option 1.** FastAPI owns authentication completely.

- Argon2id for password hashing (see ADR-0009).
- Short-lived access token (~15 min) held in memory.
- httpOnly, `Secure`, `SameSite=Lax` refresh cookie.
- **Rotation with reuse detection:** each refresh token carries a `family_id`. Redeeming
  a token that has already been used revokes the entire family, on the assumption that
  presenting a spent token means it was stolen.

## The consequence, stated plainly

**Rotation and server-side rendering of authenticated routes are incompatible here.**

If a Server Component redeemed the refresh cookie during SSR while the browser also
redeemed it, two redemptions of the same token would occur. Reuse detection would fire —
correctly, by its own logic — and log the user out. That is not a theoretical race; it
is the normal case on any page load that does both.

So the app splits:

| Surface                                    | Rendering                         | Why                                            |
| ------------------------------------------ | --------------------------------- | ---------------------------------------------- |
| `(marketing)`, `/privacy`, `/imprint`      | **Static** per locale             | Public, identical for everyone, SEO matters    |
| `(auth)`                                   | Static shell + client form        | No session yet                                 |
| `(onboarding)`, `(dashboard)`, `(profile)` | **Client-rendered** + React Query | Personalised, auth-gated, frequently refetched |

This is the correct trade regardless: dashboard data is per-user, changes often, and
benefits from React Query's caching and revalidation far more than from being rendered
once on a server.

Importantly, it does **not** weaken the case for Next.js in [ADR-0002](0002-nextjs-and-fastapi.md).
That case rests on static generation of the _marketing_ surface — the acquisition page —
which is unaffected.

## Consequences

### Positive

- One system owns sessions; no duplicated logic.
- Refresh token is unreachable from JavaScript.
- Token theft is _detected_, not merely time-limited.
- The rendering split is explicit and defensible rather than accidental.

### Negative

- CORS with credentials must be configured correctly, and misconfiguration fails
  confusingly.
- A refresh round-trip on every cold load, since the access token is memory-only.
- No server-rendered authenticated pages, so the dashboard's first paint depends on
  client JS. Mitigated with skeleton states, which are required anyway.
- Reuse detection can log out a legitimate user if two tabs race a refresh. Mitigated by
  a short grace window on the previously-issued token — to be covered by test in
  `ENG-28`.
