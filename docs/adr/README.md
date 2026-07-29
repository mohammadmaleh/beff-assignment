# Architecture Decision Records

Each record captures **why** a decision was made, what was rejected, and what it costs —
in [MADR](https://adr.github.io/madr/) format.

A decision here is settled. Changing one means writing a new ADR that supersedes it, not
editing history. That way the reasoning stays auditable even when the conclusion changes.

| #                                    | Decision                                          | Status   |
| ------------------------------------ | ------------------------------------------------- | -------- |
| [0001](0001-monorepo.md)             | Single monorepo, two deployable apps              | Accepted |
| [0002](0002-nextjs-and-fastapi.md)   | Next.js **and** FastAPI, not Next-only            | Accepted |
| [0003](0003-auth-model.md)           | FastAPI owns auth; app routes are client-rendered | Accepted |
| [0006](0006-postgres-job-queue.md)   | Postgres job queue, no Redis                      | Accepted |
| [0010](0010-primary-key-strategy.md) | Hybrid UUIDv7 / BIGINT primary keys               | Accepted |

Remaining records are written as their decisions are implemented: 0004 token pipeline,
0005 GDPR data model, 0007 i18n, 0008 testing strategy, 0009 Argon2id,
0011 brand colour vs status semantics.
