"""Draining the outbox.

The mirror of `ExportService.run_once`, and deliberately so: same claim, same
attempt accounting, same dead-letter ceiling. What differs is that the work is
an SMTP call rather than a query, and that a permanent failure here is a
refused recipient rather than a missing user.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from beff.core.email.message import EmailMessage
from beff.core.email.model import EmailDelivery
from beff.core.email.outbox import EmailOutbox
from beff.core.email.sender import EmailSender, PermanentEmailError
from beff.db.base import utcnow

__all__ = ["EmailDeliveryService"]

FAILURE_REASON_MAX_LENGTH = 500


class EmailDeliveryService:
    """Claims one queued message and sends it."""

    def __init__(
        self,
        outbox: EmailOutbox,
        *,
        sender: EmailSender,
        clock: Callable[[], datetime] = utcnow,
    ) -> None:
        self._outbox = outbox
        self._sender = sender
        self._clock = clock

    async def run_once(self) -> EmailDelivery | None:
        """Send at most one message. `None` when the queue is empty.

        Idempotent by construction: the claim moves the row out of `pending` in
        the same transaction that increments `attempts`, so a replay finds
        nothing to claim and a message that reached `sent` is never re-claimed.
        At-least-once delivery is the guarantee — a worker killed after the SMTP
        call but before the commit will send that message twice, which for a
        verification link is a duplicate email and not a duplicate effect.
        """
        now = self._clock()
        delivery = await self._outbox.claim_next(now=now)
        if delivery is None:
            return None

        message = EmailMessage(
            to=delivery.recipient,
            subject=delivery.subject,
            text=delivery.body_text,
            html=delivery.body_html,
        )

        try:
            await self._sender.send(message)
        except PermanentEmailError as exc:
            return await self._fail(delivery, str(exc), permanent=True)
        except Exception as exc:
            return await self._fail(delivery, str(exc), permanent=False)

        delivery.status = "sent"
        delivery.completed_at = now
        delivery.failure_reason = None
        return await self._outbox.finish(delivery)

    async def _fail(
        self, delivery: EmailDelivery, reason: str, *, permanent: bool
    ) -> EmailDelivery:
        """Back onto the queue, or into the dead-letter state."""
        exhausted = delivery.attempts >= delivery.max_attempts
        delivery.status = "failed" if permanent or exhausted else "pending"
        delivery.failure_reason = reason[:FAILURE_REASON_MAX_LENGTH]
        if delivery.status == "failed":
            delivery.completed_at = self._clock()
        return await self._outbox.finish(delivery)
