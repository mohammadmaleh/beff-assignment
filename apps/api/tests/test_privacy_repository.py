"""The privacy SQL, against a real PostgreSQL.

## Why this file exists

`ErasureService`, `ExportService` and `ConsentService` are all unit-tested
against `InMemory*` fakes, and those tests are worth having: the interesting
mistakes in a *service* are ordering and arithmetic, and binding them to a
container makes the check depend on Docker.

A fake is the wrong instrument for the *repository*, and this repo's own history
says so twice over. Everything below is something the database does and a fake
does not:

- `consent_records` carries a `BEFORE UPDATE` trigger that raises. Any repository
  method that issues an `UPDATE` against that table works perfectly through a
  fake and cannot work at all in production.
- the partial unique index on `users` (`WHERE deleted_at IS NULL`) is the entire
  mechanism by which erasure frees an email address for re-registration. A fake
  dict keyed by email has the opposite behaviour and never complains.
- `claim_next` is `FOR UPDATE SKIP LOCKED`. A fake pops from a list, which is
  what the query is *supposed* to do - the failure mode being guarded against is
  a second worker blocking on the first one's row, and only two real sessions
  against one real table can show that.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from beff.core.email.model import EmailDelivery
from beff.db import create_session_factory
from beff.modules.auth.models import EmailVerificationToken, RefreshToken, User
from beff.modules.privacy.models import ConsentRecord, ExportJob
from beff.modules.privacy.repository import (
    PostgresConsentRepository,
    PostgresErasureRepository,
    PostgresExportRepository,
)
from beff.modules.privacy.service import ErasureService

pytestmark = pytest.mark.integration

NOW = datetime(2026, 7, 31, 12, 0, tzinfo=UTC)


async def make_user(session: AsyncSession, email: str = "subject@beff.example") -> User:
    user = User(
        email=email,
        password_hash="argon2-placeholder",
        display_name="Subject",
        role="member",
    )
    session.add(user)
    await session.flush()
    return user


# ─────────────────────────────────────────────────────────────────────────────
# Consent
# ─────────────────────────────────────────────────────────────────────────────


async def test_latest_per_purpose_returns_the_newest_record_for_each_purpose(
    db_session: AsyncSession,
) -> None:
    """The `DISTINCT ON` has to agree with the `ORDER BY` or it inverts.

    Withdrawal is a new row, so "the current state of consent" is *only* ever
    the newest row per purpose. `DISTINCT ON` keeps the first row of each group
    as ordered - get the direction wrong and every answer is the original grant,
    which is to say every withdrawal is silently ignored.
    """
    user = await make_user(db_session)
    repository = PostgresConsentRepository(db_session)

    for purpose, granted, at in (
        ("analytics", True, NOW - timedelta(days=2)),
        ("analytics", False, NOW - timedelta(days=1)),
        ("marketing", True, NOW - timedelta(days=3)),
    ):
        await repository.append(
            ConsentRecord(
                user_id=user.id,
                purpose=purpose,
                granted=granted,
                policy_version="2026-01-01",
                recorded_at=at,
            )
        )

    latest = await repository.latest_per_purpose(user.id)

    assert set(latest) == {"analytics", "marketing"}
    assert latest["analytics"].granted is False
    assert latest["marketing"].granted is True


async def test_latest_per_purpose_ignores_another_subject(db_session: AsyncSession) -> None:
    user = await make_user(db_session)
    other = await make_user(db_session, email="other@beff.example")
    repository = PostgresConsentRepository(db_session)

    await repository.append(
        ConsentRecord(
            user_id=other.id,
            purpose="analytics",
            granted=True,
            policy_version="2026-01-01",
            recorded_at=NOW,
        )
    )

    assert await repository.latest_per_purpose(user.id) == {}


async def test_falsifying_a_record_is_still_refused_while_it_is_pseudonymised(
    db_session: AsyncSession,
) -> None:
    """Migration 0005 narrowed the trigger; this is where the narrowing is checked.

    Erasure needs one shape of `UPDATE` - `ip_hash` and `country_code` to NULL -
    and the loophole to avoid is a statement that smuggles a changed `granted`
    through alongside them. `test_migrations.py` covers the plain case of
    flipping the boolean on its own; this covers the case the exemption
    created.
    """
    user = await make_user(db_session)
    record = ConsentRecord(
        user_id=user.id,
        purpose="analytics",
        granted=True,
        policy_version="2026-01-01",
        recorded_at=NOW,
        ip_hash="d" * 64,
        country_code="DE",
    )
    db_session.add(record)
    await db_session.flush()

    with pytest.raises(DBAPIError, match="append-only"):
        await db_session.execute(
            text(
                "UPDATE consent_records "
                "SET ip_hash = NULL, country_code = NULL, granted = false "
                "WHERE id = :id"
            ),
            {"id": record.id},
        )
    await db_session.rollback()


# ─────────────────────────────────────────────────────────────────────────────
# Export jobs - the queue
# ─────────────────────────────────────────────────────────────────────────────


async def make_job(session: AsyncSession, user: User, *, requested_at: datetime) -> ExportJob:
    job = ExportJob(user_id=user.id, requested_at=requested_at)
    session.add(job)
    await session.flush()
    return job


async def test_server_defaults_reach_a_freshly_added_job(db_session: AsyncSession) -> None:
    """`add` flushes so the caller gets what the database filled in.

    `status`, `attempts` and `max_attempts` are all `server_default`. A caller
    that reads them straight back is reading the database's answer, not
    Python's - and a fake that forgets one of them has cost this repo time
    twice.
    """
    user = await make_user(db_session)

    job = await PostgresExportRepository(db_session).add(
        ExportJob(user_id=user.id, requested_at=NOW)
    )

    assert job.status == "pending"
    assert job.attempts == 0
    assert job.max_attempts > 0


async def test_latest_for_user_is_the_most_recently_requested(db_session: AsyncSession) -> None:
    user = await make_user(db_session)
    repository = PostgresExportRepository(db_session)
    await make_job(db_session, user, requested_at=NOW - timedelta(hours=2))
    newest = await make_job(db_session, user, requested_at=NOW)

    found = await repository.latest_for_user(user.id)

    assert found is not None
    assert found.id == newest.id


async def test_get_for_user_will_not_hand_a_job_to_another_account(
    db_session: AsyncSession,
) -> None:
    """Ownership is a predicate, not a check somebody can delete."""
    owner = await make_user(db_session)
    stranger = await make_user(db_session, email="stranger@beff.example")
    job = await make_job(db_session, owner, requested_at=NOW)
    repository = PostgresExportRepository(db_session)

    assert (await repository.get_for_user(job.id, owner.id)) is not None
    assert (await repository.get_for_user(job.id, stranger.id)) is None


async def test_unfinished_for_user_sees_pending_and_running_but_not_terminal(
    db_session: AsyncSession,
) -> None:
    user = await make_user(db_session)
    repository = PostgresExportRepository(db_session)

    done = await make_job(db_session, user, requested_at=NOW - timedelta(hours=1))
    done.status = "ready"
    done.completed_at = NOW
    done.payload = {"format_version": "1.0"}
    await db_session.flush()

    assert (await repository.unfinished_for_user(user.id)) is None

    live = await make_job(db_session, user, requested_at=NOW)
    found = await repository.unfinished_for_user(user.id)

    assert found is not None
    assert found.id == live.id


async def test_claim_next_takes_the_oldest_pending_job_and_counts_the_attempt(
    db_session: AsyncSession,
) -> None:
    """`attempts` is incremented on the way *in*.

    A worker SIGKILLed between claiming and failing never gets to write "that
    attempt failed", so counting on claim is the only count that survives a
    crash - and it is what makes the dead-letter ceiling mean anything.
    """
    user = await make_user(db_session)
    repository = PostgresExportRepository(db_session)
    oldest = await make_job(db_session, user, requested_at=NOW - timedelta(hours=1))
    await make_job(db_session, user, requested_at=NOW)

    claimed = await repository.claim_next(now=NOW)

    assert claimed is not None
    assert claimed.id == oldest.id
    assert claimed.status == "running"
    assert claimed.started_at == NOW
    assert claimed.attempts == 1


async def test_claim_next_returns_none_when_the_queue_is_empty(db_session: AsyncSession) -> None:
    assert (await PostgresExportRepository(db_session).claim_next(now=NOW)) is None


async def test_a_second_worker_skips_the_job_the_first_one_holds(db_engine: AsyncEngine) -> None:
    """`SKIP LOCKED` is the whole queue (ADR-0006).

    Two sessions, two open transactions, one pending row. Without `SKIP LOCKED`
    the second `SELECT ... FOR UPDATE` blocks until the first transaction ends
    and the worker pool serialises; with it, the second worker walks past the
    claimed row and reports an empty queue.

    The assertion is wrapped in a timeout because the failure mode is a *hang*,
    not a wrong answer, and a hung suite reads as a broken runner rather than a
    broken query.
    """
    factory = create_session_factory(db_engine)

    async with factory() as setup:
        user = await make_user(setup)
        await make_job(setup, user, requested_at=NOW)
        await setup.commit()

    async with factory() as first, factory() as second:
        claimed = await PostgresExportRepository(first).claim_next(now=NOW)
        assert claimed is not None

        # The first transaction is still open and still holds the row lock.
        skipped = await asyncio.wait_for(
            PostgresExportRepository(second).claim_next(now=NOW), timeout=10
        )
        assert skipped is None

        await first.rollback()
        await second.rollback()


async def test_finish_persists_the_terminal_state(db_session: AsyncSession) -> None:
    user = await make_user(db_session)
    repository = PostgresExportRepository(db_session)
    job = await make_job(db_session, user, requested_at=NOW)

    job.status = "ready"
    job.completed_at = NOW
    job.payload = {"format_version": "1.0"}
    await repository.finish(job)

    reread = (
        await db_session.execute(select(ExportJob).where(ExportJob.id == job.id))
    ).scalar_one()
    assert reread.status == "ready"
    assert reread.payload == {"format_version": "1.0"}


# ─────────────────────────────────────────────────────────────────────────────
# Erasure
# ─────────────────────────────────────────────────────────────────────────────


async def test_soft_delete_scrubs_the_row_it_stamps(db_session: AsyncSession) -> None:
    """A `deleted_at` that leaves the email and the name readable is not erasure."""
    user = await make_user(db_session)

    await PostgresErasureRepository(db_session).soft_delete_user(user.id, at=NOW)

    reread = (await db_session.execute(select(User).where(User.id == user.id))).scalar_one()
    assert reread.deleted_at == NOW
    assert reread.email == f"erased+{user.id!s}@invalid"
    assert reread.display_name == "Erased account"
    assert reread.password_hash == ""


async def test_soft_delete_frees_the_email_for_re_registration(db_session: AsyncSession) -> None:
    """The partial unique index (`WHERE deleted_at IS NULL`) is the mechanism.

    This is the assertion a fake cannot make: an in-memory dict keyed by email
    either allows the re-registration unconditionally or forbids it forever, and
    which one it does is an accident of how the fake was written.
    """
    original = await make_user(db_session, email="returning@beff.example")
    await PostgresErasureRepository(db_session).soft_delete_user(original.id, at=NOW)

    replacement = await make_user(db_session, email="returning@beff.example")

    assert replacement.id != original.id


async def test_a_live_email_address_is_still_unique(db_session: AsyncSession) -> None:
    """The other half of the partial index - freeing it on erasure is only
    correct if it is held while the account lives."""
    await make_user(db_session, email="taken@beff.example")

    with pytest.raises(IntegrityError):
        await make_user(db_session, email="taken@beff.example")


async def test_revoking_token_families_reports_only_what_it_changed(
    db_session: AsyncSession,
) -> None:
    """Idempotent: already-revoked rows keep their original timestamp."""
    user = await make_user(db_session)
    earlier = NOW - timedelta(days=1)
    for revoked_at in (None, None, earlier):
        db_session.add(
            RefreshToken(
                user_id=user.id,
                family_id=uuid4(),
                token_hash=f"{uuid4().hex}{uuid4().hex}",
                issued_at=earlier,
                expires_at=NOW + timedelta(days=30),
                revoked_at=revoked_at,
                revoked_reason=None if revoked_at is None else "logout",
            )
        )
    await db_session.flush()
    repository = PostgresErasureRepository(db_session)

    assert (await repository.revoke_all_token_families(user.id, at=NOW)) == 2
    assert (await repository.revoke_all_token_families(user.id, at=NOW)) == 0

    rows = (
        (await db_session.execute(select(RefreshToken).where(RefreshToken.user_id == user.id)))
        .scalars()
        .all()
    )
    assert {row.revoked_reason for row in rows} == {"account_erased", "logout"}


async def test_export_jobs_and_deliveries_and_tokens_are_hard_deleted(
    db_session: AsyncSession,
) -> None:
    user = await make_user(db_session)
    await make_job(db_session, user, requested_at=NOW)
    db_session.add(
        EmailDelivery(
            user_id=user.id,
            purpose="email_verification",
            recipient=user.email,
            subject="Bestätige deine E-Mail-Adresse",
            body_text="…",
        )
    )
    db_session.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash="a" * 64,
            issued_at=NOW,
            expires_at=NOW + timedelta(hours=24),
        )
    )
    await db_session.flush()
    repository = PostgresErasureRepository(db_session)

    assert (await repository.delete_export_jobs(user.id)) == 1
    assert (await repository.delete_email_deliveries(user.id)) == 1
    assert (await repository.delete_verification_tokens(user.id)) == 1

    # Idempotent - an at-least-once erasure job may run this twice.
    assert (await repository.delete_export_jobs(user.id)) == 0
    assert (await repository.delete_email_deliveries(user.id)) == 0
    assert (await repository.delete_verification_tokens(user.id)) == 0


async def test_pseudonymising_consent_keeps_the_proof_and_drops_the_person(
    db_session: AsyncSession,
) -> None:
    """Consent records survive erasure; the link to a natural person must not.

    They are retained on a different legal basis from everything else erasure
    touches - Art. 6(1)(c) and the accountability obligation in Art. 7(1) - so
    deleting them would destroy the proof that the processing which just ended
    was lawful. What has to go is `ip_hash` and `country_code`.
    """
    user = await make_user(db_session)
    db_session.add(
        ConsentRecord(
            user_id=user.id,
            purpose="analytics",
            granted=True,
            policy_version="2026-01-01",
            recorded_at=NOW,
            ip_hash="b" * 64,
            country_code="DE",
        )
    )
    await db_session.flush()

    changed = await PostgresErasureRepository(db_session).pseudonymise_consent(user.id)

    assert changed == 1
    reread = (
        (await db_session.execute(select(ConsentRecord).where(ConsentRecord.user_id == user.id)))
        .scalars()
        .all()
    )
    assert len(reread) == 1
    assert reread[0].ip_hash is None
    assert reread[0].country_code is None
    # The evidence itself is untouched.
    assert reread[0].granted is True
    assert reread[0].purpose == "analytics"
    assert reread[0].policy_version == "2026-01-01"


async def test_erasure_end_to_end_against_the_real_schema(db_session: AsyncSession) -> None:
    """The whole Art. 17 flow through the Postgres repository.

    The unit test for `ErasureService` proves the *order* is right. This proves
    the order can actually be executed - which is a different claim, and the one
    that was false.
    """
    user = await make_user(db_session, email="erasure@beff.example")
    db_session.add(
        ConsentRecord(
            user_id=user.id,
            purpose="privacy_policy",
            granted=True,
            policy_version="2026-01-01",
            recorded_at=NOW,
            ip_hash="c" * 64,
            country_code="DE",
        )
    )
    db_session.add(
        RefreshToken(
            user_id=user.id,
            family_id=uuid4(),
            token_hash="e" * 64,
            issued_at=NOW,
            expires_at=NOW + timedelta(days=30),
        )
    )
    await make_job(db_session, user, requested_at=NOW)
    await db_session.flush()

    await ErasureService(PostgresErasureRepository(db_session), clock=lambda: NOW).erase(user.id)

    reread = (await db_session.execute(select(User).where(User.id == user.id))).scalar_one()
    assert reread.deleted_at == NOW
    assert reread.email != "erasure@beff.example"

    consent = (
        (await db_session.execute(select(ConsentRecord).where(ConsentRecord.user_id == user.id)))
        .scalars()
        .all()
    )
    assert len(consent) == 1, "consent records are retained, not deleted"
    assert consent[0].ip_hash is None

    tokens = (
        (await db_session.execute(select(RefreshToken).where(RefreshToken.user_id == user.id)))
        .scalars()
        .all()
    )
    assert all(token.revoked_at == NOW for token in tokens)

    jobs = (
        (await db_session.execute(select(ExportJob).where(ExportJob.user_id == user.id)))
        .scalars()
        .all()
    )
    assert jobs == []
