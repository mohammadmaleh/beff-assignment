# ADR-0010: Hybrid primary keys — UUIDv7 where exposed, BIGINT where internal

## Status

Accepted

## Context

The default instinct for a privacy-conscious product is "UUIDs everywhere" — sequential
integers leak information. The opposing convention, and PostgreSQL's own guidance, is
`BIGINT GENERATED ALWAYS AS IDENTITY` unless there is a specific reason otherwise.

Both are right, about different tables.

## Decision drivers

- **Enumeration is a privacy risk.** `/api/v1/users/1` tells an attacker there is a user 2. Sequential IDs also leak growth rate to anyone who registers twice.
- **UUIDs cost storage and locality.** 16 bytes against 8, in every index and every
  foreign key. Random UUIDv4 keys scatter B-tree inserts across the index, causing page
  splits and write amplification.
- Some tables are never exposed and are written far more often than read individually.

## Considered options

### Option 1: UUIDv4 everywhere

- **Pros:** uniform; no ID ever leaks anything.
- **Cons:** worst insert locality of any option. On a high-volume append table like
  `audit_events`, random keys mean every insert lands on a different index page.

### Option 2: BIGINT identity everywhere

- **Pros:** smallest, fastest, best locality; PostgreSQL's default recommendation.
- **Cons:** exposes enumerable identifiers on user-facing resources. For a GDPR-facing
  product this contradicts the stated privacy posture.

### Option 3: Hybrid, chosen per table by exposure

## Decision

**Option 3.**

| Key type            | Tables                                                                                      | Reason                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **UUIDv7**          | `users`, `export_jobs`, `dsar_requests`                                                     | Appear in URLs and API responses. Enumeration must be impossible        |
| **BIGINT IDENTITY** | `audit_events`, `metric_snapshots`, `consent_records`, `waitlist_entries`, `refresh_tokens` | Never exposed; high write volume; benefit from compactness and locality |

**UUIDv7, not v4.** v7 is time-ordered, so inserts append to the right-hand edge of the
index the way a sequence does, recovering most of v4's lost locality while keeping
opacity. Generated in the application layer — `uuidv7()` is PostgreSQL 18+, and we
target 16.

## Rationale

The question "UUID or BIGINT" has no single answer; the right question is **"is this
identifier ever visible to a client?"** Where the answer is yes, opacity is worth 8
extra bytes. Where it is no, those bytes and that locality are pure cost with no
security benefit.

Using UUIDs on `audit_events` would mean paying the write-amplification penalty on the
highest-volume table in the schema in exchange for hiding an ID nobody outside the
database ever sees.

## Consequences

### Positive

- No enumerable identifiers on any user-facing resource.
- High-volume internal tables keep compact, well-clustered indexes.
- UUIDv7's time ordering means `ORDER BY id` is chronological, which is often what is
  wanted anyway.

### Negative

- Two conventions in one schema. A reader must know the rule, so it is documented in
  `CLAUDE.md` as well as here — an inconsistency that is not explained is just a bug.
- UUIDv7 generation lives in application code, so it must be centralised in one helper
  rather than reimplemented per model.
- Joining a UUID-keyed table to a BIGINT-keyed one is unremarkable, but foreign key
  column types must be declared carefully; a mismatch silently prevents index use.

### Revisit if

PostgreSQL 18 becomes the deployment target, at which point `uuidv7()` moves into the
database default and the application helper can be dropped.
