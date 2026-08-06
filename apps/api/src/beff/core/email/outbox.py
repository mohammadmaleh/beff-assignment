"""Storage for the outbox: one protocol, one PostgreSQL implementation, one fake."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Protocol, cast
from uuid import UUID

from sqlalchemy import CursorResult, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from beff.core.email.model import DEFAULT_MAX_ATTEMPTS, EmailDelivery
from beff.db.base import utcnow

__all__ = ["EmailOutbox", "InMemoryEmailOutbox", "PostgresEmailOutbox"]


class EmailOutbox(Protocol):
    """What the delivery service needs from storage.

    Deliberately the same four verbs as `ExportRepository`'s queue half. The two
    queues are the same mechanism over different rows, and naming them
    differently would hide that from the next person to add a third.
    """

    async def enqueue(self, delivery: EmailDelivery) -> EmailDelivery: ...

    async def claim_next(self, *, now: datetime) -> EmailDelivery | None:
        """Take one pending delivery, or return `None`.

        `SELECT ... FOR UPDATE SKIP LOCKED` (ADR-0006), so two workers polling
        at once never claim the same row and neither blocks on the other.
        """
        ...

    async def finish(self, delivery: EmailDelivery) -> EmailDelivery: ...

    async def pending_for_user(self, user_id: UUID, *, purpose: str) -> EmailDelivery | None:
        """An unsent message of this purpose already queued for this user.

        The idempotency boundary for resend: a user who clicks twice gets one
        message, not two identical ones a second apart.
        """
        ...


class PostgresEmailOutbox:
    """Satisfies `EmailOutbox` structurally."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def enqueue(self, delivery: EmailDelivery) -> EmailDelivery:
        self._session.add(delivery)
        # Flush, not commit. The unit of work belongs to the request, which is
        # the whole point of an outbox: the message is queued in the same
        # transaction as the account it is about, so a rolled-back registration
        # cannot leave a verification mail on its way to a user who has none.
        await self._session.flush()
        return delivery

    async def claim_next(self, *, now: datetime) -> EmailDelivery | None:
        result = await self._session.execute(
            select(EmailDelivery)
            .where(EmailDelivery.status == "pending")
            .order_by(EmailDelivery.queued_at)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        delivery = result.scalar_one_or_none()
        if delivery is None:
            return None

        delivery.status = "sending"
        delivery.started_at = now
        # Counted on the way in, as with exports. A worker SIGKILLed between
        # claiming and failing never writes "that attempt failed", so this is
        # the only count that survives a crash — and it is what stops a message
        # being retried forever.
        delivery.attempts += 1
        await self._session.flush()
        return delivery

    async def finish(self, delivery: EmailDelivery) -> EmailDelivery:
        await self._session.flush()
        return delivery

    async def pending_for_user(self, user_id: UUID, *, purpose: str) -> EmailDelivery | None:
        result = await self._session.execute(
            select(EmailDelivery)
            .where(
                EmailDelivery.user_id == user_id,
                EmailDelivery.purpose == purpose,
                EmailDelivery.status.in_(("pending", "sending")),
            )
            .order_by(EmailDelivery.queued_at)
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def delete_for_user(self, user_id: UUID) -> int:
        """Erasure. The row holds an email address in the clear."""
        result = await self._session.execute(
            delete(EmailDelivery).where(EmailDelivery.user_id == user_id)
        )
        await self._session.flush()
        return cast("CursorResult[Any]", result).rowcount


class InMemoryEmailOutbox:
    """An `EmailOutbox` backed by a list.

    Honest about what the INSERT would have filled in — `id`, `queued_at`,
    `attempts`, `max_attempts`, `status`. A fake that skips a `server_default`
    produces a `TypeError` no unit test can see, only the HTTP tests. That has
    cost this project time twice.
    """

    def __init__(self) -> None:
        self.deliveries: list[EmailDelivery] = []
        self._next_id = 1

    async def enqueue(self, delivery: EmailDelivery) -> EmailDelivery:
        delivery.id = self._next_id
        self._next_id += 1
        # `getattr` rather than `is None`: the mapped types say these are never
        # `None`, so mypy calls the direct comparison unreachable — and it is
        # right about the type and wrong about an unflushed instance, which
        # carries `None` until the database fills the default in.
        if getattr(delivery, "status", None) is None:
            delivery.status = "pending"
        if getattr(delivery, "attempts", None) is None:
            delivery.attempts = 0
        if getattr(delivery, "max_attempts", None) is None:
            delivery.max_attempts = DEFAULT_MAX_ATTEMPTS
        if getattr(delivery, "queued_at", None) is None:
            delivery.queued_at = utcnow()
        self.deliveries.append(delivery)
        return delivery

    async def claim_next(self, *, now: datetime) -> EmailDelivery | None:
        pending = sorted(
            (d for d in self.deliveries if d.status == "pending"),
            key=lambda d: (d.queued_at, d.id),
        )
        if not pending:
            return None
        delivery = pending[0]
        delivery.status = "sending"
        delivery.started_at = now
        delivery.attempts += 1
        return delivery

    async def finish(self, delivery: EmailDelivery) -> EmailDelivery:
        return delivery

    async def pending_for_user(self, user_id: UUID, *, purpose: str) -> EmailDelivery | None:
        return next(
            (
                d
                for d in sorted(self.deliveries, key=lambda d: (d.queued_at, d.id))
                if d.user_id == user_id
                and d.purpose == purpose
                and d.status in ("pending", "sending")
            ),
            None,
        )

    async def delete_for_user(self, user_id: UUID) -> int:
        before = len(self.deliveries)
        self.deliveries = [d for d in self.deliveries if d.user_id != user_id]
        return before - len(self.deliveries)
