"""The outbox SQL, against a real PostgreSQL.

`EmailDeliveryService` is unit-tested against `InMemoryEmailOutbox` - the right
instrument for retry counting and the dead-letter ceiling, which are arithmetic.
`PostgresEmailOutbox` is the other half, and every claim it makes is one the fake
cannot check:

- the transactional outbox itself. `enqueue` flushes rather than commits so the
  message is queued *in the same transaction as the account it is about*; a
  rolled-back registration must not leave a verification mail on its way to a
  user who does not exist. A list cannot be rolled back.
- `SELECT ... FOR UPDATE SKIP LOCKED`, where the failure mode is a second worker
  blocking rather than a wrong answer.
- `pending_for_user`, the idempotency boundary for resend: someone who clicks
  twice gets one message, not two identical ones a second apart.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from beff.core.email import PostgresEmailOutbox
from beff.core.email.model import EmailDelivery
from beff.db import create_session_factory
from beff.modules.auth.models import User

pytestmark = pytest.mark.integration

NOW = datetime(2026, 7, 31, 12, 0, tzinfo=UTC)
PURPOSE = "email_verification"


async def make_user(session: AsyncSession, email: str = "recipient@beff.example") -> User:
    user = User(email=email, password_hash="x", display_name="Recipient", role="member")
    session.add(user)
    await session.flush()
    return user


def message(user: User, *, queued_at: datetime = NOW, subject: str = "Bestätige") -> EmailDelivery:
    return EmailDelivery(
        user_id=user.id,
        purpose=PURPOSE,
        recipient=user.email,
        subject=subject,
        body_text="Hier ist dein Link.",
        queued_at=queued_at,
    )


async def test_enqueue_returns_what_the_database_filled_in(db_session: AsyncSession) -> None:
    """`status`, `attempts` and `max_attempts` are all `server_default`.

    A fake that skips one of them produces a 500 or a `TypeError` that no unit
    test can see, only the HTTP tests. This is the row those defaults are copied
    from.
    """
    user = await make_user(db_session)

    delivery = await PostgresEmailOutbox(db_session).enqueue(message(user))

    assert delivery.id is not None
    assert delivery.status == "pending"
    assert delivery.attempts == 0
    assert delivery.max_attempts > 0
    assert delivery.completed_at is None


async def test_enqueue_does_not_commit_the_callers_transaction(db_engine: AsyncEngine) -> None:
    """The point of a transactional outbox.

    The message is queued in the same unit of work as the registration it
    belongs to, so a registration that rolls back takes the mail with it.
    `enqueue` calling `commit` would break that silently - everything still
    works, and a user whose signup failed receives a verification link for an
    account that does not exist.
    """
    factory = create_session_factory(db_engine)

    async with factory() as session:
        user = await make_user(session)
        await PostgresEmailOutbox(session).enqueue(message(user))
        await session.rollback()

    async with factory() as reader:
        rows = (await reader.execute(select(EmailDelivery))).scalars().all()

    assert rows == []


async def test_claiming_takes_the_oldest_and_counts_the_attempt(
    db_session: AsyncSession,
) -> None:
    """Counted on the way in, as with exports.

    A worker SIGKILLed between claiming and sending never writes "that attempt
    failed", so this is the only count that survives a crash - and it is what
    stops a message being retried forever.
    """
    user = await make_user(db_session)
    outbox = PostgresEmailOutbox(db_session)
    oldest = await outbox.enqueue(message(user, queued_at=NOW - timedelta(minutes=5)))
    await outbox.enqueue(message(user, queued_at=NOW))

    claimed = await outbox.claim_next(now=NOW)

    assert claimed is not None
    assert claimed.id == oldest.id
    assert claimed.status == "sending"
    assert claimed.started_at == NOW
    assert claimed.attempts == 1


async def test_claiming_an_empty_outbox_returns_none(db_session: AsyncSession) -> None:
    """The normal case, several times a second, forever."""
    assert await PostgresEmailOutbox(db_session).claim_next(now=NOW) is None


async def test_a_claimed_message_is_not_claimed_again(db_session: AsyncSession) -> None:
    """`status = 'pending'` is the predicate; a claim moves the row out of it."""
    user = await make_user(db_session)
    outbox = PostgresEmailOutbox(db_session)
    await outbox.enqueue(message(user))

    assert await outbox.claim_next(now=NOW) is not None
    assert await outbox.claim_next(now=NOW) is None


async def test_a_second_worker_skips_the_message_the_first_one_holds(
    db_engine: AsyncEngine,
) -> None:
    """`SKIP LOCKED`, from the side that shows the difference.

    Without it the second worker blocks on the first one's row until that
    transaction ends, and a two-replica worker deployment quietly delivers mail
    at the speed of one. Wrapped in a timeout because the failure is a hang, and
    a hung suite reads as a broken runner rather than a broken query.
    """
    factory = create_session_factory(db_engine)

    async with factory() as setup:
        user = await make_user(setup)
        await PostgresEmailOutbox(setup).enqueue(message(user))
        await setup.commit()

    async with factory() as first, factory() as second:
        assert await PostgresEmailOutbox(first).claim_next(now=NOW) is not None

        skipped = await asyncio.wait_for(
            PostgresEmailOutbox(second).claim_next(now=NOW), timeout=10
        )
        assert skipped is None

        await first.rollback()
        await second.rollback()


async def test_finishing_persists_the_terminal_state(db_session: AsyncSession) -> None:
    user = await make_user(db_session)
    outbox = PostgresEmailOutbox(db_session)
    delivery = await outbox.enqueue(message(user))

    delivery.status = "sent"
    delivery.completed_at = NOW
    await outbox.finish(delivery)

    reread = (
        await db_session.execute(select(EmailDelivery).where(EmailDelivery.id == delivery.id))
    ).scalar_one()
    assert reread.status == "sent"
    assert reread.completed_at == NOW


async def test_pending_for_user_is_the_idempotency_boundary_for_resend(
    db_session: AsyncSession,
) -> None:
    """A message being *sent* counts as pending too.

    Both `pending` and `sending` are in the predicate, and the second is the one
    that matters: a resend arriving while a worker holds the row would otherwise
    queue a duplicate that nobody asked for.
    """
    user = await make_user(db_session)
    outbox = PostgresEmailOutbox(db_session)

    assert await outbox.pending_for_user(user.id, purpose=PURPOSE) is None

    queued = await outbox.enqueue(message(user))
    found = await outbox.pending_for_user(user.id, purpose=PURPOSE)
    assert found is not None
    assert found.id == queued.id

    claimed = await outbox.claim_next(now=NOW)
    assert claimed is not None
    assert await outbox.pending_for_user(user.id, purpose=PURPOSE) is not None


async def test_a_finished_message_no_longer_blocks_a_resend(db_session: AsyncSession) -> None:
    """Once it is sent, asking again is a new request, not a duplicate."""
    user = await make_user(db_session)
    outbox = PostgresEmailOutbox(db_session)
    delivery = await outbox.enqueue(message(user))
    delivery.status = "sent"
    delivery.completed_at = NOW
    await outbox.finish(delivery)

    assert await outbox.pending_for_user(user.id, purpose=PURPOSE) is None


async def test_pending_for_user_is_scoped_by_purpose_and_by_account(
    db_session: AsyncSession,
) -> None:
    """A queued password-reset must not suppress a verification mail."""
    user = await make_user(db_session)
    stranger = await make_user(db_session, email="stranger@beff.example")
    outbox = PostgresEmailOutbox(db_session)
    await outbox.enqueue(message(user))

    assert await outbox.pending_for_user(user.id, purpose="password_reset") is None
    assert await outbox.pending_for_user(stranger.id, purpose=PURPOSE) is None
    assert await outbox.pending_for_user(uuid4(), purpose=PURPOSE) is None


async def test_deleting_a_users_messages_is_idempotent(db_session: AsyncSession) -> None:
    """Erasure runs this - every row holds an email address in the clear - and
    an at-least-once job may run it twice."""
    user = await make_user(db_session)
    outbox = PostgresEmailOutbox(db_session)
    await outbox.enqueue(message(user))
    await outbox.enqueue(message(user, subject="Erinnerung"))

    assert await outbox.delete_for_user(user.id) == 2
    assert await outbox.delete_for_user(user.id) == 0
