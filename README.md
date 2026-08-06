# Beff - Pre-Launch SaaS MVP

**Production intelligence for battery cell manufacturing.** See where yield is lost,
what it costs in scrap, and what it means for CO₂ per kWh.

Built as a technical take-home for Beff GmbH (Stuttgart). Not an official Beff product -
the domain is modelled on the problem space the company works in.

|               |                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------- |
| **Live app**  | <https://beff-eta.vercel.app>                                                            |
| **API docs**  | <https://http--beff-api--ygq2pkp2lvtn.code.run/docs>                                     |
| **Sign in**   | `demo@beff.example` / `beff-demo-password`                                               |
| **Figma**     | [Beff - Design System & Product](https://www.figma.com/design/NmFvnuLBYD0FF9RvSVzl5Q/)   |
| **Repo**      | <https://github.com/mohammadmaleh/beff-assignment>                                       |
| **Deep dive** | [`documents/`](documents/README.md) - decisions in full, 11 ADRs, design brief, glossary |

The demo account has onboarding complete and sixty batches behind it, so the dashboard is
populated on first load. One process parameter is deliberately **out of spec** - a
dashboard where everything is green never demonstrates that it can show a problem.

---

## Run it

```bash
cp .env.example .env
docker compose up          # postgres + migrate + api + worker + web
```

Web → <http://localhost:3000> · API docs → <http://localhost:8000/docs>

Migrations and the demo seed run in a one-shot `migrate` service that gates the API, so
the stack comes up usable from an empty volume.

Without Docker:

```bash
pnpm install && pnpm dev                                           # frontend
cd apps/api && uv sync && uv run uvicorn beff.main:app --reload    # backend
```

## Look at the design system

```bash
pnpm storybook             # http://localhost:6006
```

21 stories across the component library - every state each component ships: default,
hover, focus-visible, active, disabled, loading, error, and both themes. The same
components are in Figma, pushed from the code with the tokens as Figma variables.

## Run the tests

```bash
# everything the CI runs
pnpm lint && pnpm typecheck && pnpm test && pnpm build
cd apps/api && uv run ruff check . && uv run mypy && uv run pytest --cov

# coverage reports
pnpm test                                  # every JS package, coverage printed per package
pnpm --filter @beff/ui test                # one package
cd apps/api && uv run pytest --cov --cov-report=term-missing

pnpm test:e2e                              # Playwright against the standalone build
pnpm test:a11y                             # axe-core, WCAG 2.2 AA, both locales
```

---

## Architecture

Monorepo, two deployables. **The frontend never talks to the database; the backend never
renders HTML.**

```mermaid
graph TD
    web["<b>apps/web</b> - Next.js 16, React 19<br/>Marketing + legal: static per locale<br/>App surface: client-rendered, React Query"]
    api["<b>apps/api</b> - FastAPI, Python 3.12<br/>auth · onboarding · privacy · metrics · waitlist"]
    worker["<b>worker</b> - same image, different command<br/>drains the export queue"]
    db[("<b>PostgreSQL 16</b><br/>app data + job queue + rate-limit counters")]

    web -->|"JSON, bearer access token<br/>+ httpOnly refresh cookie"| api
    api --> db
    worker -->|"SELECT … FOR UPDATE SKIP LOCKED"| db

    style web fill:#476f95,color:#faf8f5
    style api fill:#476f95,color:#faf8f5
    style worker fill:#2f5374,color:#faf8f5
```

| Layer    | Stack                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Frontend | Next.js 16, React 19, TypeScript 5.9, Tailwind 4, React Query, ECharts, next-intl-style typed dictionaries |
| Design   | Style Dictionary tokens → CSS + typed TS, Storybook 10, Figma variables                                    |
| Backend  | FastAPI, SQLAlchemy 2 async, Alembic, Pydantic v2, Argon2id                                                |
| Database | PostgreSQL 16 - application data **and** the job queue. No Redis                                           |
| Testing  | pytest + testcontainers, Vitest, Testing Library, Playwright, axe-core                                     |
| Tooling  | pnpm + Turborepo, uv, ruff, mypy strict, ESLint, GitHub Actions                                            |

```
apps/web              Next.js frontend          packages/ui           design system, subpath exports
apps/api              FastAPI backend           packages/tokens       design tokens + contrast gates
                                                packages/api-client   generated from OpenAPI
                                                packages/e2e          Playwright + axe
```

Every unit - React component or Python module - lives in its own folder with a barrel and
its test co-located. Consumers import the barrel, never an implementation file.

**Five decisions worth knowing**, each argued properly in
[`DECISIONS.md`](documents/DECISIONS.md) and recorded as an [ADR](documents/adr/README.md):

1. **Next.js _and_ FastAPI**, not Next alone - the brief requires one of NestJS/FastAPI,
   and Route Handlers are neither. The cost is contract drift; a generated TS client with
   a CI job that fails on drift pays it.
2. **The API owns auth end to end** - short-lived JWT in memory, httpOnly refresh cookie,
   rotation with reuse detection. That rules out server-rendering authenticated routes
   (SSR and the browser would race to redeem the same cookie), so the app surface is
   client-rendered and the marketing surface is static.
3. **Postgres is the job queue** - `FOR UPDATE SKIP LOCKED` gives persistence, retries,
   idempotency, backoff and a dead-letter state without a second datastore to run. Redis
   becomes right somewhere north of 1k jobs/sec.
4. **Hybrid primary keys** - UUIDv7 where an id reaches a client, `BIGINT IDENTITY` where
   it never does.
5. **Compose, not Kubernetes** - but the app is orchestrator-ready where it matters:
   separate liveness and readiness probes, env-only config, stateless API.

---

## What is in it

**Product**

- Landing, product and technology pages - statically generated, both locales, crawlable
- Dashboard: four headline KPIs, scrap breakdown **in process order** (a bar's position is
  economic information - a cell lost at formation has absorbed every upstream cost), yield
  trend, throughput, cost of position, control chart, and every parameter against its
  tolerance band
- Onboarding wizard - plant and line setup, progress persisted server-side after each
  step, so it resumes on any device
- Profile - consent, data export, account deletion
- Auth: register, email verification, login, silent refresh, logout
- Waiting list for signed-out visitors
- German and English, with `de.ts` typed against the English dictionary so a missing
  translation is a build error

**Engineering**

- Rate limiting on every anonymous and credential endpoint, keyed on a salted IP hash,
  per origin rather than per email
- RFC 9457 Problem Details with stable machine-readable codes, so the German locale shows
  German errors without the backend knowing what language is on screen
- Request-id correlation through every log line, honouring an inbound `X-Request-ID`
- Four states on every data surface - loading, empty, error, partial - as a type error to
  forget
- Deployment declared in [`deploy/northflank/`](deploy/northflank/), secrets generated at
  apply time, `DATABASE_URL` linked rather than copied

**GDPR** (`modules/privacy`)

| Right                | Article     | Implementation                                                                                                                                                                            |
| -------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consent              | Art. 7      | Append-only records enforced by a database trigger. There is no `update` method anywhere in the service _or its repository protocol_ - the absence is the design                          |
| Access / Portability | Art. 15, 20 | Queued export job; JSON, self-describing, no password hashes and no third party's data                                                                                                    |
| Erasure              | Art. 17     | Ordered: sessions, then exports, then consent pseudonymised (kept - it is the proof the processing was lawful), then the account soft-deleted so the partial unique index frees the email |

IP addresses are never stored raw - salted hash plus country code, which is the finest
location granularity in the schema. `DECISIONS.md` carries the full Art. 30 register.

---

## Accessibility

Target WCAG 2.2 AA, gated in CI, and **not claimed as met** - see below.

Contrast is compiled, not reviewed: tokens are authored once as JSON and Style Dictionary
compiles them, with two gates that _fail the build_ - every semantic text/surface pair
clears 4.5:1 (3:1 large/UI), and chart series stay separable under simulated deuteranopia
and protanopia. The palette was solved against the gate, not picked and then checked.

Colour is never the only signal. The brand accent never appears inside a chart -
`success`/`warning`/`danger` mean _in spec_ and _out of spec_, and a green brand would
make every chart ambiguous. Charts ship a data-table alternative, and the table is the
authoritative rendering while the bars are `aria-hidden`.

Beyond axe, `packages/e2e/tests/screen-reader.spec.ts` walks Chromium's accessibility tree
and asserts what gets _announced_: one `h1` per page, no skipped heading level, no two
links sharing a name and differing in destination, every field announcing its label and
required state - and that the German surfaces are announced in German. That last rule
exists because the pass found a real bug: `packages/ui` built its screen-reader text from
English literals, so the German landing page announced the product's signature element
entirely in English. No screenshot, no contrast gate and no axe rule can see that.

**Honestly not done:** nobody has listened to this with NVDA, JAWS or VoiceOver - the tree
is audited, the ear is not, so the AA claim stays unmade. The company film ships without
captions (WCAG 1.2.2 A unmet, suppressed inline at the one call site with a reason, not
switched off in config). Chromium only.

---

## The method, in one paragraph

A gate is not trusted until it has been **observed failing** - run against a deliberately
broken input and seen to exit non-zero. That rule is here because a green suite twice
failed to see a shipped bug in this project: 300 passing tests sat on top of a consent
feature that was completely broken against a real PostgreSQL, and a login rate limiter
passed its tests while counting only the requests that did _not_ need limiting (it shared
the request transaction, which rolls back on exception, so every failed login rolled back
its own increment). Adding tests would have found neither. Running the assertion against a
known-bad input is what does.
