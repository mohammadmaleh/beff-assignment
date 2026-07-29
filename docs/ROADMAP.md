# Roadmap & Handoff

**Read this first if you are picking up the project.** It is the single source of truth
for _where we are_, _what is next_, and _how to prove a step is actually done_.

Linear board: [Beff — Pre-Launch SaaS MVP](https://linear.app/mos-space/project/beff-pre-launch-saas-mvp-e1ecb9993700) (`ENG-18` → `ENG-43`)

---

## How to pick up

1. Read `CLAUDE.md` — conventions, and the **Traps already hit** table. Those mistakes
   cost time once; do not pay again.
2. Read `CONTEXT.md` — domain vocabulary. Use these terms, and keep seeded numbers
   inside the stated ranges.
3. Read **Decisions already made** below. Do not relitigate them; if you disagree, write
   an ADR superseding one.
4. Find the first unchecked box in **Checkpoints**. That is your task.
5. Run the **Definition of done** in `CLAUDE.md` before claiming anything works.

---

## Current state

**Done and verified by running it:**

- Monorepo (pnpm + Turborepo), FastAPI app, Next.js app, shared config package
- `pnpm lint`, `typecheck`, `test`, `build`, `format:check` — all green
- Backend `ruff`, `mypy --strict`, `pytest --cov` — green, 100% on what exists
- `/` builds as `○ (Static)`, so the SSG claim behind choosing Next is demonstrable
- a11y lint rules **confirmed to fail** on a deliberate probe (missing alt,
  click-without-keyboard, `autoFocus`) — a linter that cannot fail proves nothing
- `pnpm-lock.yaml` committed, so CI's `--frozen-lockfile` works
- README, ADRs 0001/0002/0003/0006/0010, CLAUDE.md, CONTEXT.md, pre-mortem

**⚠️ Not verified — needs action:** `docker compose build` and `docker compose up` have
**never been run**. The Docker daemon was not running in the authoring environment and
starting it required interactive sudo. The Dockerfiles and compose file are written and
`docker compose config` validates, but the images have not been built.

**First thing to do in the next session:**

```bash
sudo service docker start      # or start Docker Desktop
docker compose build
docker compose up -d
curl -f localhost:8000/healthz && curl -f localhost:3000
```

Expect to fix something — a multi-stage build written without being run rarely works
first time. Likely suspects: the pnpm store cache mount, and whether Next's standalone
output lands at `apps/web/server.js` given the monorepo `outputFileTracingRoot`.

---

## Decisions already made

Settled. Each has or will have an ADR. Changing one means writing a superseding ADR,
not a quiet edit.

| #   | Decision                                        | Short reason                                                                                             |
| --- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | Next.js **and** FastAPI, not Next-only          | The brief mandates NestJS or FastAPI; Route Handlers are neither                                         |
| 2   | FastAPI only, no NestJS                         | Depth over breadth; TS is already proven by web + design system + Playwright                             |
| 3   | FastAPI owns auth end-to-end                    | Consequence: authenticated routes are **client-rendered**. Refresh rotation makes SSR redemption unsafe  |
| 4   | **No Redis.** Postgres `FOR UPDATE SKIP LOCKED` | No load justifies a second datastore; keeps retries, idempotency, DLQ                                    |
| 5   | **Compose, not Kubernetes**                     | A reviewer must run it in one command. App is orchestrator-_ready_ (split probes, env config, stateless) |
| 6   | TypeScript **5.9.3**, not 7.x                   | TS 7 is stable but Next 16 + Storybook 10 + eslint-typescript is untested surface                        |
| 7   | Three GDPR features, not two                    | Erasure doubles as the brief's mandated offboarding                                                      |
| 8   | Brand accent never collides with status colours | Green means _in spec_ in a yield chart; a green brand makes every chart ambiguous                        |
| 9   | Figma **last**                                  | Free-tier MCP quota is finite — spend it once, on a confirmed design                                     |
| 10  | Unit folders + barrels + co-located tests       | See `CLAUDE.md` → File organisation                                                                      |

---

## Checkpoints

Each box is provable. Do not tick one without running its command and seeing it pass.

### M1 · Foundations

- [x] `ENG-18` Monorepo skeleton — `turbo.json` uses `tasks`
- [x] `ENG-19` FastAPI skeleton — ruff, mypy strict, pytest green
- [x] `ENG-22` CLAUDE.md, CONTEXT.md, pre-mortem
- [x] `ENG-18b` Next.js app + `pnpm-lock.yaml` committed
  - Verified: `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test`
- [x] README skeleton + ADRs 0001, 0002, 0003, 0006, 0010
- [ ] **`ENG-20` Dockerfiles are written but have NEVER BEEN BUILT** ← _next task_
  - **Verify:** `docker compose build && docker compose up -d && curl -f localhost:8000/healthz && curl -f localhost:3000`
- [ ] `ENG-21` CI green on a real push
  - **Verify:** `gh run list --limit 1` shows success

**Gate:** a fresh clone runs `docker compose up` and serves both apps. Until that is
true, nothing else should start — the README's quickstart is currently a promise the
repo has not been shown to keep.

### M2 · Design System

- [ ] `ENG-23` Style Dictionary tokens → CSS vars + Tailwind `@theme`
  - Slate foundation + electric cyan brand; `success`/`warning`/`danger` reserved
  - **Verify:** contrast script proves every semantic text/surface pair ≥ 4.5:1 (3:1 large/UI)
- [ ] `ENG-24` shadcn/Radix primitives in `packages/ui`, subpath exports
  - **Verify:** bundle analysis shows importing one component does not pull the library
- [ ] `ENG-25` Storybook + a11y addon, a story per state
  - **Verify:** `pnpm test:storybook` passes

**Gate:** a component can be consumed by `apps/web` with zero style duplication.

### M3 · Backend

- [ ] `ENG-27` Schema + Alembic migrations
  - **Verify:** `alembic upgrade head && alembic downgrade base` both clean; test proves
    the partial unique index lets a purged email re-register
- [ ] `ENG-28` Auth — rotation **with reuse detection**
  - **Verify:** integration test replays a used refresh token and asserts the whole family is revoked
- [ ] `ENG-29` RFC 9457 Problem Details
  - **Verify:** invalid registration renders server-sourced inline field errors in EN and DE
- [ ] `ENG-30` Onboarding, resumable
  - **Verify:** interrupt mid-wizard, reload, resume at the same step
- [ ] `ENG-31` GDPR — consent, export jobs, erasure
  - **Verify:** job replayed twice produces one export (idempotency); killed worker's job is reclaimed
- [ ] `ENG-32` Metrics + seed
  - **Verify:** seeded values sit inside `CONTEXT.md` ranges

**Gate:** `uv run pytest --cov` ≥ 85%, and user A provably cannot read user B's data.

### M4 · Frontend

- [ ] `ENG-33` Generated API client + CI drift check
  - **Verify:** change a Pydantic schema without regenerating → CI fails
- [ ] `ENG-34` Landing — SSG, EN/DE, SEO, Impressum + Datenschutz
  - **Verify:** `curl` the built page and see content in the HTML source, not just after hydration
- [ ] `ENG-35` Cookie banner — nothing pre-checked, Reject as prominent as Accept
- [ ] `ENG-36` Auth pages + onboarding wizard
- [ ] `ENG-37` Dashboard — accessible charts with data-table alternative
- [ ] `ENG-38` Profile — consent, export, danger zone

**Gate:** every flow completable **keyboard-only**.

### M5 · Quality

- [ ] `ENG-39` Playwright E2E, 3 browsers + mobile
- [ ] `ENG-40` axe + Lighthouse + **manual screen-reader pass**
- [ ] `ENG-41` Security review + coverage gates

**Gate:** zero Critical/Serious a11y findings; `/security-review` clean or triaged.

### M6 · Launch

- [ ] `ENG-42` Deploy — Vercel + Fly + Neon
- [ ] `ENG-26` Figma library → screens → Code Connect (**quota: foundations first**)
- [ ] `ENG-43` README, 11 ADRs, C4 diagrams, Art. 30 register

**Gate:** a reviewer understands every significant decision without reading code.

---

## Debt register

Things deliberately deferred. Not forgotten — decide explicitly before the final review.

| Item                               | Status                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| Email sending (verification)       | Undecided. Options: log to console in dev, or Mailpit in compose. Must not block registration |
| Rate limiting                      | Needed on auth + export (`ENG-41`). Without Redis this is a Postgres counter or in-process    |
| Observability                      | `structlog` is a dependency but no request-ID/correlation strategy is written                 |
| Seed + demo account                | A reviewer must be able to log in **without registering**. Credentials go in the README       |
| `LICENSE`                          | Missing                                                                                       |
| Next `error.tsx` / `not-found.tsx` | Not planned; a polished app has them                                                          |
| Dependency audits non-blocking     | `\|\| true` in CI. Tighten at `ENG-41` once the baseline is clean                             |

---

## Scope warning

Take-homes are graded on what is **finished**, not what is attempted. If time runs
short, cut in this order — and say so in the README rather than leaving it silently
undone:

1. Visual regression (`ENG-25`, partial)
2. Art. 15 access log — the 4th GDPR feature; the brief only asks for two
3. WebKit + mobile E2E targets — keep Chromium
4. DE locale — keep the i18n architecture, ship EN only

**Never cut:** the accessibility gate, the README's "design choices" and "UI/UX
intuitiveness" sections, or the erasure flow. Those are explicitly graded.
