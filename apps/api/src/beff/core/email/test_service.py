"""The delivery worker's half: claim, send, retry, dead-letter."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from beff.core.email.model import EmailDelivery
from beff.core.email.outbox import InMemoryEmailOutbox
from beff.core.email.sender import PermanentEmailError, RecordingEmailSender
from beff.core.email.service import EmailDeliveryService

NOW = datetime(2026, 8, 5, 12, 0, tzinfo=UTC)
USER = UUID("01890000-0000-7000-8000-000000000001")


def _delivery(**overrides: object) -> EmailDelivery:
    fields: dict[str, object] = {
        "user_id": USER,
        "purpose": "email_verification",
        "recipient": "ada@example.test",
        "subject": "Confirm your email address",
        "body_text": "Follow the link.",
        "body_html": "<p>Follow the link.</p>",
    }
    fields.update(overrides)
    return EmailDelivery(**fields)


async def _service(
    outbox: InMemoryEmailOutbox, sender: RecordingEmailSender, at: datetime = NOW
) -> EmailDeliveryService:
    return EmailDeliveryService(outbox, sender=sender, clock=lambda: at)


async def test_an_empty_queue_is_not_an_error() -> None:
    """The normal state. The worker polls this far more often than it works."""
    sender = RecordingEmailSender()
    service = await _service(InMemoryEmailOutbox(), sender)

    assert await service.run_once() is None
    assert sender.sent == []


async def test_a_queued_message_is_sent_and_marked_sent() -> None:
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery())
    sender = RecordingEmailSender()

    delivery = await (await _service(outbox, sender)).run_once()

    assert delivery is not None
    assert delivery.status == "sent"
    assert delivery.completed_at == NOW
    assert delivery.failure_reason is None
    assert [m.to for m in sender.sent] == ["ada@example.test"]


async def test_the_message_sent_is_the_one_that_was_stored() -> None:
    """The row is the record of what a person was sent.

    Re-rendering at send time would let a template edited between queueing and
    sending change what a queued message says — and would make the stored row a
    description of something that never happened.
    """
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery(subject="Bestätigen Sie Ihre E-Mail-Adresse"))
    sender = RecordingEmailSender()

    await (await _service(outbox, sender)).run_once()

    assert sender.sent[0].subject == "Bestätigen Sie Ihre E-Mail-Adresse"
    assert sender.sent[0].html == "<p>Follow the link.</p>"


async def test_the_attempt_is_counted_on_the_way_in() -> None:
    """Counted at claim time, not on failure.

    A worker SIGKILLed between claiming and failing never writes "that attempt
    failed", so a count kept on the failure path undercounts exactly the crashes
    the ceiling exists to survive.
    """
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery())

    delivery = await (await _service(outbox, RecordingEmailSender())).run_once()

    assert delivery is not None
    assert delivery.attempts == 1


async def test_a_transient_failure_goes_back_on_the_queue() -> None:
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery())
    sender = RecordingEmailSender(fail_with=TimeoutError("connection reset"))

    delivery = await (await _service(outbox, sender)).run_once()

    assert delivery is not None
    assert delivery.status == "pending"
    assert delivery.completed_at is None
    assert "connection reset" in (delivery.failure_reason or "")


async def test_a_permanent_failure_never_gets_a_second_attempt() -> None:
    """Retrying a refused recipient burns the budget to learn the same thing."""
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery())
    sender = RecordingEmailSender(fail_with=PermanentEmailError("550 no such user"))

    delivery = await (await _service(outbox, sender)).run_once()

    assert delivery is not None
    assert delivery.status == "failed"
    assert delivery.attempts == 1
    assert delivery.completed_at == NOW


async def test_a_transient_failure_dead_letters_once_the_budget_is_spent() -> None:
    """Otherwise a deterministically failing message is retried forever, and the
    queue never drains past it."""
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery(max_attempts=2))
    sender = RecordingEmailSender(fail_with=TimeoutError("nope"))
    service = await _service(outbox, sender)

    first = await service.run_once()
    assert first is not None and first.status == "pending"

    second = await service.run_once()
    assert second is not None
    assert second.status == "failed"
    assert second.attempts == 2


async def test_a_sent_message_is_never_claimed_again() -> None:
    """The idempotency guarantee, stated as a test.

    The claim moves the row out of `pending` in the same transaction that counts
    the attempt, so a replay finds nothing — which is what stops a restarted
    worker re-sending everything it had already delivered.
    """
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery())
    sender = RecordingEmailSender()
    service = await _service(outbox, sender)

    await service.run_once()
    assert await service.run_once() is None
    assert len(sender.sent) == 1


async def test_the_oldest_message_is_sent_first() -> None:
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery(recipient="second@example.test", queued_at=NOW))
    await outbox.enqueue(
        _delivery(recipient="first@example.test", queued_at=NOW - timedelta(hours=1))
    )
    sender = RecordingEmailSender()

    await (await _service(outbox, sender)).run_once()

    assert sender.sent[0].to == "first@example.test"


async def test_a_failure_reason_is_truncated_to_what_the_column_holds() -> None:
    """A provider that returns a wall of text would otherwise violate the CHECK
    and turn a failed send into a failed *transaction*, losing the attempt
    count with it."""
    outbox = InMemoryEmailOutbox()
    await outbox.enqueue(_delivery())
    sender = RecordingEmailSender(fail_with=TimeoutError("x" * 2000))

    delivery = await (await _service(outbox, sender)).run_once()

    assert delivery is not None
    assert delivery.failure_reason is not None
    assert len(delivery.failure_reason) == 500
