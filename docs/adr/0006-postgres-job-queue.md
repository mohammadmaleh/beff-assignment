# ADR-0006: Postgres-backed job queue instead of Redis

## Status

Accepted

## Context

Two operations must not run inside a request:

- **Data export (GDPR Art. 20)** — assembling a user's data into a downloadable archive.
  Slow enough to time out a request, and it must survive a process restart.
- **Erasure sweep (GDPR Art. 17)** — after the 30-day grace period, permanently
  anonymising accounts. Scheduled, not user-triggered.

Both need persistence, retries, idempotency, and a place for permanently-failed work to
land. The obvious reach is Redis with `arq` or Celery, and the job description lists
Redis in the company's stack.

## Decision drivers

- The product is **pre-launch**. There is no load, no cache pressure, no queue depth.
- Every piece of infrastructure must be **explainable in an interview**. Infrastructure
  present because it is conventional, rather than because it is needed, is a liability.
- A reviewer must run the whole stack with **one command**.
- Deployment cost: a second datastore means another managed service to provision,
  secure and monitor.

## Considered options

### Option 1: Redis + arq

- **Pros:** the conventional answer; battle-tested; matches the JD's listed stack;
  scales well past anything this product will see.
- **Cons:** a second datastore to run locally, deploy, and monitor. Adds a hosted Redis
  to production. Introduced a real dependency conflict — `arq` 0.28 constrains
  `redis<6`, which silently caps an otherwise-current dependency. Most importantly, it
  is infrastructure whose failure modes I would be reasoning about abstractly rather
  than from this codebase.

### Option 2: FastAPI `BackgroundTasks`

- **Pros:** zero infrastructure; already available.
- **Cons:** runs in the API process, so a restart loses in-flight work. No retries, no
  persistence, no visibility. Unacceptable for an operation with a legal deadline
  attached.

### Option 3: Postgres queue via `FOR UPDATE SKIP LOCKED`

- **Pros:** no new infrastructure. The database is already there, already backed up,
  already in the transaction. `SKIP LOCKED` lets multiple workers pull disjoint rows
  without blocking each other. Job state is queryable with ordinary SQL, which makes
  debugging and the admin view trivial.
- **Cons:** polling rather than push, so pickup latency is bounded by the poll interval.
  Throughput ceiling far lower than Redis — in the low thousands of jobs per second
  rather than millions. Requires implementing visibility timeouts by hand.

## Decision

**Option 3.** A `jobs` table, claimed with:

```sql
UPDATE jobs SET status = 'running', claimed_at = now(), attempts = attempts + 1
WHERE id = (
  SELECT id FROM jobs
  WHERE status = 'pending' AND run_after <= now()
  ORDER BY run_after
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```

Every property that matters is preserved: an explicit state machine
(`pending → running → succeeded | failed | dead`), idempotency keys so a replayed job
does not duplicate work, exponential backoff via `run_after`, a visibility timeout so a
crashed worker's job is reclaimed rather than stuck, and a dead-letter state for
permanent failures.

## Rationale

The throughput ceiling is irrelevant at pre-launch volume, and the polling latency is
irrelevant for an export the user is told will take a moment. What is not irrelevant is
that this is one fewer service to run, deploy, secure and explain — and that its
behaviour is fully visible in `SELECT * FROM jobs`.

Choosing Redis here would be optimising for a scale that does not exist, at the cost of
complexity that does.

## Consequences

### Positive

- `docker compose up` needs Postgres and nothing else.
- Job state is inspectable with SQL — no separate tooling to see what a worker is doing.
- Enqueue happens **inside the same transaction** as the state change that triggers it,
  so a job can never reference a row that was rolled back. A separate datastore cannot
  give this without a transactional outbox.
- One less production dependency to secure and monitor.

### Negative

- Pickup latency is bounded by the poll interval (~1s), not instant.
- Long-polling worker connections consume a Postgres connection each; at high worker
  counts this needs PgBouncer.
- Visibility timeout and backoff are hand-written, so they are ours to get right — and
  ours to test. Covered by `ENG-31`, including a reclaim-after-crash test.
- Will not scale past roughly low-thousands of jobs per second.

### When to revisit

Move to Redis or SQS when any of these becomes true: sustained throughput above ~1k
jobs/sec, sub-second pickup latency becomes a product requirement, or job volume starts
competing with application queries for database connections.
