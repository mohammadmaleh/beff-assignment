# Beff — Pre-Launch SaaS MVP

Production intelligence for battery cell manufacturing. Built as a technical take-home
for Beff GmbH (Stuttgart). See `assignment-description.md` for the brief and
`docs/adr/` for why things are the way they are.

## Architecture

Monorepo, two deployable apps:

- **`apps/web`** — Next.js 16 App Router. Marketing surface is statically generated;
  the authenticated app surface is client-rendered with React Query.
- **`apps/api`** — FastAPI. Owns auth end-to-end. PostgreSQL only.
- **`packages/ui`** — design system. **`packages/api-client`** — generated from OpenAPI.

The frontend never talks to the database. The backend never renders HTML.

**There is no Redis.** Background jobs run on a Postgres-backed queue using
`SELECT ... FOR UPDATE SKIP LOCKED`. At pre-launch volume this keeps persistence,
retries, idempotency and a dead-letter path without a second datastore to run, deploy
and monitor. See ADR-0006 for when Redis would become the right call.

## Commands

```bash
# Full stack
docker compose up                     # postgres + api + web + worker

# Frontend (from repo root)
pnpm dev | build | lint | typecheck | test
pnpm test:storybook | test:e2e | test:a11y

# Backend (from apps/api — uv is at ~/.local/bin)
uv run pytest --cov                   # 85% floor, enforced
uv run ruff check . && uv run ruff format .
uv run mypy                           # strict
uv run alembic upgrade head
```

## Definition of done

Nothing is "done" until this passes. Run it; do not assume it.

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
cd apps/api && uv run ruff check . && uv run mypy && uv run pytest --cov
```

## Conventions

### Everywhere

- **TDD.** Test first, watch it fail, then implement.
- Commits reference their Linear issue: `feat(ENG-31): ...`
- Never commit secrets. `.env.example` is the contract; `.env` is ignored.

### File organisation — both languages

Every unit lives in **its own folder** with a **barrel** and its **test co-located**.
Nothing is left loose in a shared directory. This is the React component-folder pattern
applied consistently across the repo.

```
# Backend                              # Frontend
modules/auth/                          components/Button/
├── __init__.py        ← barrel        ├── index.ts          ← barrel
├── router/                            ├── Button.tsx
│   ├── __init__.py    ← barrel        ├── Button.test.tsx
│   ├── login.py                       └── Button.stories.tsx
│   └── test_login.py  ← co-located
├── service/
├── repository/
├── schemas/
└── models/
```

Consumers import from the barrel, never from an implementation file, so internal layout
can change without touching call sites.

**The barrel rule is not "no barrels".** It is:

| | |
|---|---|
| ✅ Per-unit barrel behind a subpath export | `@beff/ui/button` → `components/Button/index.ts` |
| ❌ One root barrel re-exporting everything | `@beff/ui` → `src/index.ts` exporting all 40 components |

The root barrel is what defeats tree-shaking — importing one button drags in the whole
library. Per-unit barrels cost nothing. In Python the question does not arise at all:
there is no tree-shaking, so `__init__.py` barrels are purely upside.

### Python (`apps/api`)

- **Domain modules**, not technical layers. A feature's code stays together.
  `router` does HTTP only; `service` holds business logic and knows nothing about HTTP
  or SQL; `repository` does data access.
- Repositories are `typing.Protocol` — services take fakes in unit tests, no inheritance.
- Explicit `__all__` in every barrel. **Absolute imports only** (ruff enforces this).
- **Unit tests are co-located** (`src/**/test_*.py`). `tests/` holds only fixtures and
  integration tests, which span units and belong to no single one.
  Shared fixtures live in `apps/api/conftest.py` — a conftest only applies to its own
  directory and below, so one inside `tests/` would be invisible to `src/`.
- Split files at 300–500 lines.
- `datetime.now(UTC)` — **never `datetime.utcnow()`**, deprecated in 3.12. Ruff's `DTZ`
  rules catch this.
- `T | None`, not `Optional[T]`. `mypy --strict` must stay clean.

### Database

Rules that are easy to get wrong and are enforced by review:

- `TIMESTAMPTZ` always. Never bare `TIMESTAMP`, never a precision spec.
- `TEXT` always. Never `VARCHAR(n)` — use `CHECK (length(col) <= n)`.
- **No PostgreSQL `ENUM` types** for evolving business values — `TEXT + CHECK (col IN (...))`.
  Altering a PG enum is painful.
- **Index every foreign key.** Postgres does not do it for you.
- Primary keys are hybrid: UUIDv7 where opacity matters and the ID is exposed
  (`users`, `export_jobs`, `dsar_requests`); `BIGINT GENERATED ALWAYS AS IDENTITY`
  for internal high-volume tables. See ADR-0010.
- Soft delete uses a **partial unique index** (`WHERE deleted_at IS NULL`) so erasure
  frees the email for re-registration.

### GDPR (`modules/privacy`)

- **Consent records are append-only.** Never `UPDATE` a boolean — you must be able to
  prove what was consented to, when, and against which policy version.
- Never store a raw IP. Salted hash + country code only, never city-level.
- Exports exclude password hashes and any third party's data.
- Background jobs must be **idempotent** — at-least-once delivery means retries happen.
  Do not retry permanent failures (validation errors).

### Frontend (`apps/web`, `packages/ui`)

- **No root barrel in `packages/ui`** — subpath exports only (see the barrel rule above).
  Per-component `index.ts` files are required, not forbidden.
- **Native HTML before ARIA.** ARIA is a last resort, not a first move.
- Every component ships all states: default, hover, focus-visible, active, disabled,
  loading, error. Every data surface: loading, empty, error, partial.
- Colour is never the only signal. `success`/`warning`/`danger` are reserved for data
  semantics — the brand accent must never appear in a chart.
- `tabular-nums` on every metric and table figure.
- CSS **logical properties** (`padding-inline`) — German text runs ~30% longer than
  English and DE is a shipped locale.
- Animate `transform`/`opacity` only. Respect `prefers-reduced-motion`.

## Traps already hit

Do not reintroduce these — each cost time once:

| Trap | Correct form |
|---|---|
| `turbo.json` with `"pipeline"` | `"tasks"` — `pipeline` is Turborepo 1.x and silently no-ops on v2 |
| `AsyncClient(app=app)` | `AsyncClient(transport=ASGITransport(app=app))` — removed in httpx 0.28 |
| Adding Redis for the job queue | Postgres `FOR UPDATE SKIP LOCKED`. Redis was dropped deliberately — see ADR-0006. (It also collided: arq 0.28 pins `redis<6`.) |
| A conftest inside `tests/` | Shared fixtures go in `apps/api/conftest.py`; a conftest is invisible to sibling trees, so co-located tests under `src/` would not see it |
| `datetime.utcnow()` | `datetime.now(UTC)` |
| TypeScript 7 | Pinned to 5.9.3. TS 7 is stable but Next 16 + Storybook 10 + eslint-typescript is too much untested surface for a deliverable |

## Accessibility

Target WCAG 2.2 AA, gated in CI. Automated tooling catches only **30–50%** of issues,
so the manual screen-reader pass is mandatory, not optional. Charts get a data-table
alternative and non-colour encoding — that is where dashboards usually fail.

## Domain language

See `CONTEXT.md`. Use the real terms — cell, calendering, formation, first-pass yield,
capacity retention — consistently across schema, API and UI. A domain-literate reviewer
will notice if the numbers or names are implausible.
