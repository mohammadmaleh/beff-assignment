# ADR-0001: Single monorepo containing both applications

## Status

Accepted

## Context

The project has two deployable applications ([ADR-0002](0002-nextjs-and-fastapi.md)):
a Next.js frontend and a FastAPI backend. The brief says "Host on GitHub and ensure
proper project structure and README" — singular repository implied, but not stated.

## Decision drivers

- A reviewer's first action is `git clone`. Two repositories doubles that friction and
  makes it impossible to see the whole system at once.
- The frontend/backend contract is generated from OpenAPI. Generator and consumer must
  version together or the CI drift check is meaningless.
- Shared tooling — Prettier, ESLint, TypeScript config — should be defined once.

## Considered options

### Option 1: Two repositories

- **Pros:** independent deploy cadence and access control; each repo stays small.
- **Cons:** a change spanning both requires two PRs that cannot be atomic. The
  generated client would have to be published as a package or vendored. For a reviewer,
  two clone URLs and no single place that shows the system.

### Option 2: Monorepo, pnpm workspaces + Turborepo

- **Pros:** one clone. Atomic cross-cutting commits. Shared config defined once.
  Turborepo caches per-task, so unchanged packages are skipped in CI.
- **Cons:** Python does not participate in pnpm workspaces, so the backend is managed
  separately by `uv` inside the same tree — two dependency managers to understand.

### Option 3: Monorepo with Nx

- **Pros:** richer generators and dependency-graph tooling.
- **Cons:** significantly more configuration than two apps justify.

## Decision

**Option 2.** pnpm workspaces for the JavaScript side, Turborepo for task orchestration
and caching, `uv` for Python inside `apps/api`.

```
apps/web        Next.js
apps/api        FastAPI (uv, not part of the pnpm workspace)
packages/ui     design system
packages/api-client   generated from OpenAPI
packages/config shared eslint / tsconfig
```

## Rationale

The decisive factor is the generated API client. It is produced from the backend's
OpenAPI schema and consumed by the frontend; if those live in separate repositories, a
schema change and its client regeneration cannot land atomically, and the CI drift check
degrades into a race. In one repository it is a single commit.

Turborepo over plain workspace scripts because task-level caching keeps CI honest as the
number of packages grows, and because its `tasks` graph makes build ordering explicit
rather than implied by script naming.

## Consequences

### Positive

- One clone, one CI configuration, one place a reviewer can read the whole system.
- Cross-cutting changes are atomic and reviewable as a unit.
- Shared lint and TypeScript config cannot drift between packages.
- Turborepo skips unchanged packages, so CI time scales with what changed.

### Negative

- **Two dependency managers.** `pnpm` and `uv` coexist; a contributor must know which
  applies where. Documented in `CLAUDE.md` under Commands.
- Turborepo cache invalidation is only as correct as its declared `inputs`/`outputs`;
  a wrong declaration produces stale builds that are confusing to debug.
- The Python app cannot be a workspace member, so `pnpm build` does not build it. CI
  runs the backend as a separate job.
- Turborepo 2 renamed `pipeline` to `tasks`. Most documentation online still shows
  `pipeline`, which silently does nothing. Recorded in `CLAUDE.md`'s traps table.
