# ADR-0002: Next.js **and** FastAPI, not Next.js alone

## Status

Accepted

## Context

The brief asks for a landing page, an onboarding flow, a dashboard, a GDPR profile page,
and "a minimal backend to support user's onboarding and offboarding".

Next.js can serve all of that on its own. Route Handlers and Server Actions cover
mutations, and a single deployable is genuinely simpler: one language, one CI pipeline,
no CORS, no duplicated types.

So the simplest reading of the brief argues for Next-only.

## Decision drivers

- The brief states: **"Use either the NestJS or FastAPI framework."** That is a
  requirement, not a suggestion.
- The job description assigns Python specifically to "FastAPI for data services", and
  Beff is a battery-**data** company.
- The role is full-stack. Demonstrating only the frontend half answers half the question.
- Whatever is chosen must be defensible in an interview under follow-up questions.

## Considered options

### Option 1: Next.js only

- **Pros:** one deployable, one language, no CORS, no cross-service type drift, fastest
  to build.
- **Cons:** **Next.js Route Handlers are neither NestJS nor FastAPI.** However good the
  result, it fails an explicit written requirement — which reads as either not having
  read the brief or having decided the requirement did not apply.

### Option 2: Next.js + NestJS

- **Pros:** satisfies the requirement; TypeScript end to end; shares types with the
  frontend without generation.
- **Cons:** the JD lists NestJS _and_ Python; picking the TypeScript option sidesteps
  demonstrating Python at all. Weaker fit for a data-oriented product.

### Option 3: Next.js + FastAPI

- **Pros:** satisfies the requirement; matches the JD's own framing of where Python
  belongs; demonstrates both languages the role calls for. OpenAPI comes free, which
  makes a generated, type-safe client possible.
- **Cons:** two runtimes, CORS to configure, and the frontend/backend contract must be
  kept in sync deliberately.

### Option 4: All three (Next + NestJS + FastAPI)

- **Pros:** maximum surface coverage of the JD.
- **Cons:** three stacks at production quality is not achievable well. Half-finished
  breadth reads worse than complete depth.

## Decision

**Option 3.** Next.js for the frontend, FastAPI for the backend, in one monorepo.

Next.js earns its place on the frontend for a specific, testable reason rather than
familiarity: the marketing surface is **statically generated per locale**, so the
acquisition page ships as HTML with no JS-blocked content for crawlers. The build output
reports `/` as `○ (Static)` — the claim is verifiable, not asserted.

The contract between them is generated: FastAPI emits `openapi.json`, from which the
TypeScript client and React Query hooks are generated, with a CI job that fails on
drift. That converts "two runtimes means type drift" from a real cost into a
non-problem, and demonstrates the internal-tooling instinct the JD asks for.

## Rationale

Option 1 is the only one that would have been _simpler_, and it is disqualified by a
single sentence in the brief. Given that, Option 3 is the one that both satisfies the
requirement and demonstrates the specific combination the role is hiring for.

## Consequences

### Positive

- The brief's framework requirement is met unambiguously.
- Both languages named in the JD are demonstrated at production quality.
- Static generation on the marketing surface is a real, measurable advantage rather than
  a stylistic preference.
- OpenAPI gives a single source of truth for the contract.

### Negative

- CORS configuration, and credentials must be handled explicitly on cross-origin
  requests.
- Two toolchains in CI, two container images, two deploy targets.
- The generated client is a build step that can go stale — mitigated by the CI drift
  check, which is itself a thing that must be maintained.
- See [ADR-0003](0003-auth-model.md): keeping auth entirely in FastAPI means
  authenticated routes cannot be Server Components. That is a real, accepted narrowing
  of what Next.js contributes.
