# Beff — Pre-Launch SaaS MVP

**Production intelligence for battery cell manufacturing.** See where yield is lost,
what it costs in scrap, and what it means for CO₂ per kWh.

> Built as a technical take-home for Beff GmbH (Stuttgart). This is an **assignment
> build**, not an official Beff product — the domain is modelled on the problem space
> the company works in.

🚧 **In progress.** Foundations are complete and verified; feature milestones are
tracked in [`docs/ROADMAP.md`](docs/ROADMAP.md) with a verification command per
checkpoint.

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
Next Route Handlers are neither. The full reasoning, including what was rejected, is in
[ADR-0002](docs/adr/0002-nextjs-and-fastapi.md).

---

## Design choices

Each links to the record that explains what was rejected and what it costs.

| Decision                                                             | Short reason                                                                                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [Next.js **and** FastAPI](docs/adr/0002-nextjs-and-fastapi.md)       | Brief mandates one of NestJS/FastAPI; Next earns its place by statically generating the acquisition surface                                  |
| [FastAPI owns auth](docs/adr/0003-auth-model.md)                     | One system owns sessions. Consequence: refresh rotation makes SSR of authenticated routes unsafe, so those are client-rendered               |
| [Postgres job queue, no Redis](docs/adr/0006-postgres-job-queue.md)  | A pre-launch product has no load to justify a second datastore. Enqueue happens in the same transaction as the state change that triggers it |
| [Hybrid UUIDv7 / BIGINT keys](docs/adr/0010-primary-key-strategy.md) | Opacity where IDs are exposed; compactness and locality where they never leave the database                                                  |
| [Monorepo](docs/adr/0001-monorepo.md)                                | The generated API client and the schema it derives from must version atomically                                                              |
| Compose, not Kubernetes                                              | A reviewer must run it in one command. The app is orchestrator-_ready_ — separate liveness/readiness probes, env-only config, stateless API  |

**Colour is a data decision, not a taste one.** The brand accent is deliberately kept
away from `success`/`warning`/`danger`. In a yield dashboard green means _in spec_ and
red means _out of spec_; a green brand would make every chart ambiguous.

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
apps/web           Next.js frontend
apps/api           FastAPI backend
packages/ui        design system (subpath exports, no root barrel)
packages/api-client   generated from OpenAPI
packages/config    shared eslint / tsconfig
docs/adr           architecture decision records (MADR)
docs/product       pre-mortem
CONTEXT.md         battery domain glossary
CLAUDE.md          conventions + traps already hit
```

---

## What I would do next

_Completed at submission — see [`docs/ROADMAP.md`](docs/ROADMAP.md) for the current
debt register and the deliberate scope cuts._
