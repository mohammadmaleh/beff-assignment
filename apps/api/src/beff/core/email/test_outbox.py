"""The in-memory outbox, and the debts it owes the database.

`PostgresEmailOutbox` is exercised by the integration tests, which have a real
`FOR UPDATE SKIP LOCKED` to exercise. What is under test here is the fake — and
specifically that it is not more permissive than production, because a fake that
skips a `server_default` produces a failure only the HTTP tests can see.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from beff.core.email.model import DEFAULT_MAX_ATTEMPTS, EmailDelivery
from beff.core.email.outbox import InMemoryEmailOutbox

NOW = datetime(2026, 8, 5, 12, 0, tzinfo=UTC)
USER = UUID("01890000-0000-7000-8000-000000000001")
OTHER = UUID("01890000-0000-7000-8000-000000000002")


def _delivery(**overrides: object) -> EmailDelivery:
    fields: dict[str, object] = {
        "user_id": USER,
        "purpose": "email_verification",
        "recipient": "ada@example.test",
        "subject": "Confirm",
        "body_text": "Follow the link.",
    }
    fields.update(overrides)
    return EmailDelivery(**fields)


async def test_enqueue_fills_in_everything_the_insert_would_have() -> None:
    """The fake stands in for the INSERT, so it owes the caller the defaults.

    Skipping one is not cosmetic: `claim_next` increments `attempts`, and
    `None + 1` is a `TypeError` no unit test using this fake could see.
    """
    outbox = InMemoryEmailOutbox()

    delivery = await outbox.enqueue(_delivery())

    assert delivery.id is not None
    assert delivery.status == "pending"
    assert delivery.attempts == 0
    assert delivery.max_attempts == DEFAULT_MAX_ATTEMPTS
    assert delivery.queued_at is not None


async def test_ids_are_distinct() -> None:
    """Mirrors the identity column. Two rows sharing an id would make the
    ordering tie-break in `claim_next` meaningless."""
    outbox = InMemoryEmailOutbox()

    first = await outbox.enqueue(_delivery())
    second = await outbox.enqueue(_delivery())

    assert first.id != second.id


async def test_claiming_takes_the_oldest_pending_row() -> None:
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery(recipient="new@example.test", queued_at=NOW))
    await outbox.enqueue(
        _delivery(recipient="old@example.test", queued_at=NOW - timedelta(hours=1))
    )

    claimed = await outbox.claim_next(now=NOW)

    assert claimed is not None
    assert claimed.recipient == "old@example.test"


async def test_claiming_moves_the_row_out_of_pending() -> None:
    """Which is what makes a second claim find nothing, and is therefore the
    whole idempotency story."""
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery())

    first = await outbox.claim_next(now=NOW)
    second = await outbox.claim_next(now=NOW)

    assert first is not None
    assert first.status == "sending"
    assert first.started_at == NOW
    assert second is None


async def test_a_pending_message_is_found_for_its_user_and_purpose() -> None:
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery())

    found = await outbox.pending_for_user(USER, purpose="email_verification")

    assert found is not None


async def test_another_users_pending_message_is_not_found() -> None:
    """The resend idempotency check keys on this. Getting it wrong would let one
    user's queued message suppress another's."""
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery())

    assert await outbox.pending_for_user(OTHER, purpose="email_verification") is None


async def test_a_different_purpose_is_not_found() -> None:
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery())

    assert await outbox.pending_for_user(USER, purpose="password_reset") is None


async def test_a_sent_message_is_no_longer_pending() -> None:
    """Otherwise a user who confirmed nothing could never get a second link:
    the first, long-delivered message would suppress every resend forever."""
    outbox = InMemoryEmailOutbox()
    delivery = await outbox.enqueue(_delivery())
    delivery.status = "sent"

    assert await outbox.pending_for_user(USER, purpose="email_verification") is None


async def test_a_message_being_sent_right_now_still_counts_as_pending() -> None:
    """`sending` is in flight, not finished. Treating it as finished would queue
    a duplicate for anyone who clicks resend while the worker holds the row."""
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery())
    await outbox.claim_next(now=NOW)

    assert await outbox.pending_for_user(USER, purpose="email_verification") is not None


async def test_deleting_for_a_user_leaves_other_users_alone() -> None:
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery())
    await outbox.enqueue(_delivery(user_id=OTHER, recipient="grace@example.test"))

    removed = await outbox.delete_for_user(USER)

    assert removed == 1
    assert [d.user_id for d in outbox.deliveries] == [OTHER]
