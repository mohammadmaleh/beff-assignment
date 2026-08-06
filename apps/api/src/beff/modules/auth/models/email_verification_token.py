"""The `email_verification_tokens` table.

The client is handed a random string; only its SHA-256 is stored, exactly as
with refresh tokens. A database leak therefore hands over no live verification
links - which matters more here than it looks, because following one of these
proves control of an address and is a step in most account-takeover chains.

Written once per registration and never exposed, so the key is
`BIGINT GENERATED ALWAYS AS IDENTITY` (ADR-0010). The opaque thing is the token,
not the row.
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
    Text,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from beff.db.base import Base

__all__ = ["TOKEN_HASH_LENGTH", "EmailVerificationToken"]

TOKEN_HASH_LENGTH: Final = 64  # SHA-256, hex-encoded.


class EmailVerificationToken(Base):
    """One outstanding - or spent - verification link.

    Single use. `consumed_at` is stamped inside the same transaction that
    stamps `users.email_verified_at`, so a link that is followed twice (a mail
    client prefetching, a user double-clicking) verifies once and reports the
    second attempt honestly rather than pretending it failed.

    No `TimestampMixin`: `issued_at` is the creation time and the row is only
    ever stamped, never edited. Same reasoning as `refresh_tokens`.
    """

    __tablename__ = "email_verification_tokens"
    __table_args__ = (
        CheckConstraint(f"length(token_hash) = {TOKEN_HASH_LENGTH}", name="token_hash_length"),
        CheckConstraint("expires_at > issued_at", name="expires_after_issue"),
        Index("ix_email_verification_tokens_user_id", "user_id"),
        Index("uq_email_verification_tokens_token_hash", "token_hash", unique=True),
        # Resending invalidates whatever is outstanding, so "the live tokens for
        # this user" is a hot query and the table is mostly spent rows.
        Index(
            "ix_email_verification_tokens_user_id_live",
            "user_id",
            postgresql_where=text("consumed_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)

    user_id: Mapped[UUID] = mapped_column(
        Uuid(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    token_hash: Mapped[str] = mapped_column(Text(), nullable=False)

    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def is_consumed(self) -> bool:
        return self.consumed_at is not None

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<EmailVerificationToken id={self.id} consumed={self.is_consumed}>"
