"""The `email_deliveries` table — a transactional outbox for mail.

Sending inside the request would make registration depend on an SMTP round
trip: slow when the provider is slow, and a failed signup when the provider is
down, for a message the user does not need before their account exists. The row
is written in the same transaction as the account, and a worker sends it.

Same queue as exports, same reasoning (ADR-0006): `SELECT ... FOR UPDATE SKIP
LOCKED` over a table gives persistence, retries, idempotency and a dead-letter
path with no second datastore.

Not in a domain module. Mail is infrastructure several modules will want —
verification today, password reset next — and putting the table under
`modules/auth` would make the second caller import from the first. Same
placement, and the same reason, as `rate_limit_counters`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Final
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from beff.db.base import Base, sql_value_list, utcnow

__all__ = [
    "DEFAULT_MAX_ATTEMPTS",
    "EMAIL_DELIVERY_STATUSES",
    "RECIPIENT_MAX_LENGTH",
    "SUBJECT_MAX_LENGTH",
    "TERMINAL_EMAIL_DELIVERY_STATUSES",
    "EmailDelivery",
]

# `pending` and `sending` are the queue's; `sent` and `failed` are terminal.
# TEXT + CHECK, never a PostgreSQL ENUM.
EMAIL_DELIVERY_STATUSES: Final = ("pending", "sending", "sent", "failed")

TERMINAL_EMAIL_DELIVERY_STATUSES: Final = ("sent", "failed")

DEFAULT_MAX_ATTEMPTS: Final = 3

RECIPIENT_MAX_LENGTH: Final = 254  # RFC 5321 forward path.
SUBJECT_MAX_LENGTH: Final = 300
FAILURE_REASON_MAX_LENGTH: Final = 500


class EmailDelivery(Base):
    """One message queued for sending.

    The rendered subject and body are stored rather than a template name and
    parameters. Two reasons, and the second is the one that matters: a template
    edited between queueing and sending would otherwise change what a queued
    message says, and the row is the only record of what was actually sent to a
    person — which is what makes it answerable under Art. 15.

    `recipient` is personal data. It is deleted, not pseudonymised, on erasure.

    Internal and written on every registration, so the key is
    `BIGINT GENERATED ALWAYS AS IDENTITY` (ADR-0010) — nothing here is ever
    exposed to a client, so there is no opacity requirement to satisfy.
    """

    __tablename__ = "email_deliveries"
    __table_args__ = (
        CheckConstraint(
            f"status IN {sql_value_list(EMAIL_DELIVERY_STATUSES)}", name="status_allowed"
        ),
        CheckConstraint("attempts >= 0", name="attempts_not_negative"),
        CheckConstraint("max_attempts > 0", name="max_attempts_positive"),
        CheckConstraint(f"length(recipient) <= {RECIPIENT_MAX_LENGTH}", name="recipient_length"),
        CheckConstraint("length(recipient) > 0", name="recipient_not_blank"),
        CheckConstraint(f"length(subject) <= {SUBJECT_MAX_LENGTH}", name="subject_length"),
        CheckConstraint(
            f"failure_reason IS NULL OR length(failure_reason) <= {FAILURE_REASON_MAX_LENGTH}",
            name="failure_reason_length",
        ),
        # A `sent` row with no completion time cannot be reconciled against a
        # provider log, which is the one question this table exists to answer.
        CheckConstraint(
            "status <> 'sent' OR completed_at IS NOT NULL",
            name="sent_requires_completed_at",
        ),
        Index("ix_email_deliveries_user_id", "user_id"),
        # The queue's own index. Partial, because the table is overwhelmingly
        # finished deliveries and the claim only ever looks at pending ones.
        Index(
            "ix_email_deliveries_pending_queued_at",
            "queued_at",
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)

    # Nullable: a message can outlive its account, and mail will eventually be
    # sent to addresses that have none. `CASCADE` rather than `SET NULL` because
    # the row holds the recipient address in the clear — an orphaned delivery
    # would be personal data with nothing left to justify keeping it.
    user_id: Mapped[UUID | None] = mapped_column(
        Uuid(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )

    # What the message is for. Not a foreign key and not a state — it is how an
    # operator answers "did the verification mail go out" without reading
    # subjects, and how a future password-reset flow stays distinguishable here.
    purpose: Mapped[str] = mapped_column(Text(), nullable=False)

    recipient: Mapped[str] = mapped_column(Text(), nullable=False)
    subject: Mapped[str] = mapped_column(Text(), nullable=False)
    body_text: Mapped[str] = mapped_column(Text(), nullable=False)
    body_html: Mapped[str | None] = mapped_column(Text(), nullable=True)

    status: Mapped[str] = mapped_column(Text(), nullable=False, server_default=text("'pending'"))

    attempts: Mapped[int] = mapped_column(Integer(), nullable=False, server_default=text("0"))
    max_attempts: Mapped[int] = mapped_column(
        Integer(), nullable=False, server_default=text(str(DEFAULT_MAX_ATTEMPTS))
    )

    queued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    failure_reason: Mapped[str | None] = mapped_column(Text(), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<EmailDelivery id={self.id} purpose={self.purpose!r} status={self.status!r}>"
