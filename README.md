# Beff — Pre-Launch SaaS MVP

**Production intelligence for battery cell manufacturing.** See where yield is lost,
what it costs in scrap, and what it means for CO₂ per kWh.

> Built as a technical take-home for Beff GmbH (Stuttgart). This is an **assignment
> build**, not an official Beff product — the domain is modelled on the problem space
> the company works in.

🚧 **In progress.** Foundations are complete and verified; feature work is tracked on
a Linear board, with a verification command defined per checkpoint.

---

## Quickstart

```bash
cp .env.example .env
docker compose up            # postgres + api + web
```

- Web → <http://localhost:3000>
- API docs → <http://localhost:8000/docs>
- OpenAPI schema → <http://localhost:8000/openapi.json>

Running without Docker:

```bash
pnpm install && pnpm dev                         # frontend
cd apps/api && uv sync && uv run uvicorn beff.main:app --reload   # backend
```

---

## Architecture

```
                     ┌──────────────────────────────┐
   crawlers ────────▶│  Next.js 16 (App Router)     │
                     │  (marketing)  STATIC ◀── SSG per locale
                     │  (auth)       static shell + CSR
                     │  (dashboard)  CSR + React Query
                     └──────────┬───────────────────┘
                                │ credentials: include
                     ┌──────────▼───────────────────┐
                     │  FastAPI (Python 3.12)       │
                     │  auth · onboarding · privacy │
                     │  metrics · waitlist          │
                     └──────────┬───────────────────┘
                                ▼
                          PostgreSQL 16
                     (also the job queue —
                      FOR UPDATE SKIP LOCKED)
```

| Layer    | Choice                                                                   |
| -------- | ------------------------------------------------------------------------ |
| Frontend | Next.js 16, React 19, TypeScript 5.9, Tailwind 4, shadcn/ui, React Query |
| Backend  | FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic v2, Argon2id            |
| Database | PostgreSQL 16 — application data **and** the job queue                   |
| Testing  | pytest, Vitest, Testing Library, Playwright, axe-core, Storybook         |
| Tooling  | pnpm + Turborepo, uv, ruff, mypy strict, ESLint, GitHub Actions          |

**Why two apps rather than Next.js alone:** the brief requires NestJS or FastAPI, and
Next Route Handlers are neither. Full reasoning in [Design choices](#design-choices).

---

## Design choices

### Next.js **and** FastAPI, not Next.js alone

Next-only is genuinely the simpler option — one deployable, one language, no CORS, no
cross-service type drift. It is disqualified by one sentence in the brief: _"Use either
the NestJS or FastAPI framework."_ Route Handlers are neither.

Given a second service was required, FastAPI over NestJS because the job description
assigns Python specifically to "FastAPI for data services", and this is a data product.

Next.js then has to earn its place on the frontend rather than be assumed. It does, for
one measurable reason: the marketing surface is **statically generated**, so the
acquisition page ships as HTML with no JS-blocked content for crawlers. The build output
reports `/` as `○ (Static)` — verifiable, not asserted.

**Cost:** CORS with credentials, two toolchains in CI, and a contract that must be kept
in sync. That last one is handled by generating the TypeScript client from the backend's
OpenAPI schema, with a CI job that fails on drift.

### FastAPI owns authentication — and the consequence

Short-lived JWT in memory, httpOnly `SameSite` refresh cookie, **rotation with reuse
detection** (tokens carry a `family_id`; redeeming a spent token revokes the family, on
the assumption it was stolen).

The consequence is worth stating rather than hiding: **rotation and server-rendering
authenticated routes are incompatible.** If a Server Component redeemed the refresh
cookie during SSR while the browser also redeemed it, reuse detection would fire —
correctly — and log the user out. That is the normal case on page load, not a rare race.

So the marketing surface is static and the app surface is client-rendered with React
Query. That is the right trade anyway: dashboard data is per-user and refetched often,
which benefits far more from a query cache than from one server render.

### Postgres as the job queue — no Redis

Data export and the erasure sweep both need persistence, retries and idempotency. The
conventional reach is Redis, and the JD lists it.

A pre-launch product has no load to justify a second datastore. `SELECT … FOR UPDATE SKIP
LOCKED` gives an explicit state machine, idempotency, exponential backoff, a visibility
timeout and a dead-letter state — with one fewer service to run, deploy, secure and
monitor. It also lets a job be enqueued **inside the same transaction** as the state
change that triggers it, so a job can never reference a rolled-back row.

**Cost:** polling latency instead of push, and a throughput ceiling in the low thousands
per second. Both irrelevant here. Redis becomes correct above roughly 1k jobs/sec.

### Hybrid primary keys

"UUIDs everywhere" and "BIGINT everywhere" are both right, about different tables. The
question that actually has an answer is **"is this identifier ever visible to a client?"**

- **UUIDv7** for `users`, `export_jobs`, `dsar_requests` — exposed in URLs, so
  enumeration must be impossible. v7 rather than v4 because it is time-ordered and keeps
  index locality.
- **BIGINT IDENTITY** for `audit_events`, `metric_snapshots`, `consent_records` — never
  exposed, high write volume, and 8 bytes beats 16 in every index.

### Compose, not Kubernetes

A reviewer must be able to run this with one command. Two services and a database do not
justify ingress, manifests and a cluster, and reaching for them would read as
disproportionate tooling.

The app is nonetheless orchestrator-**ready** where it matters: liveness and readiness
are separate probes (`/healthz` deliberately touches no dependencies — restarting a
container because the database blipped makes an outage worse), config is env-only, and
the API is stateless.

### Colour is a data decision, not a taste one

The brand accent is deliberately kept away from `success` / `warning` / `danger`. In a
yield dashboard green means _in spec_ and red means _out of spec_; a green brand would
make every chart ambiguous. Chart palettes are colourblind-safe and never encode meaning
in hue alone.

---

## How I approached UI/UX intuitiveness

_Filled in as the UI lands (ENG-34 → ENG-38). The principles it will document:_

- **The user is a time-poor process engineer, not a browser.** They arrive with a
  question — "why did yield drop on line 3?" — so the dashboard leads with what changed,
  not with what is easy to render.
- **Every data surface has four states**, not one. Loading, empty, error and partial are
  designed, not afterthoughts, because real production data is frequently incomplete.
- **Destructive actions carry friction, never confusion.** Account deletion states
  exactly what is removed, what is retained and why, and how long the grace period lasts.
- **German runs ~30% longer than English.** Logical properties and no truncation-
  dependent layouts, verified at every breakpoint.

---

## Accessibility

Target **WCAG 2.2 AA**, gated in CI.

- `jsx-a11y` rules run as **errors**, verified to fail on real violations rather than
  assumed to work
- `axe-core` on every route in E2E; zero serious/critical permitted
- A story per component state in Storybook, with a11y assertions
- Charts ship a data-table alternative and never encode meaning in colour alone
- **A manual screen-reader pass is mandatory** — automated tooling detects only 30–50%
  of issues

---

## GDPR

Three data subject rights, one of which is required by the brief twice — erasure is also
the "offboarding" it asks for.

| Right       | Article | Implementation                                                                                                                |
| ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Consent     | Art. 7  | Append-only records; never an `UPDATE` on a boolean, so consent state at any past moment is provable against a policy version |
| Portability | Art. 20 | Async export job; signed download URL expiring in 24h                                                                         |
| Erasure     | Art. 17 | Soft delete → 30-day cancellable grace → anonymisation                                                                        |

IP addresses are personal data, so they are stored as a salted hash plus country code —
never raw, never city-level.

---

## Testing

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
cd apps/api && uv run ruff check . && uv run mypy && uv run pytest --cov
```

Backend enforces an **85% coverage floor**. Unit tests are co-located with the code they
cover; `tests/` holds only fixtures and integration tests that span units.

---

## Repository layout

```
apps/web              Next.js frontend
apps/api              FastAPI backend
packages/ui           design system (subpath exports, no root barrel)
packages/api-client   generated from OpenAPI
packages/config       shared eslint / tsconfig
```

Domain vocabulary — process steps, metric definitions and their plausible ranges — is
maintained alongside the schema so terminology stays consistent across database, API and
UI.

---

## What I would do next

_Completed at submission._
