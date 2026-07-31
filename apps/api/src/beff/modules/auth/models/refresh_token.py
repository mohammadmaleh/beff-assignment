"""The `refresh_tokens` table — rotation with family-wide reuse detection.

Never exposed to a client and written on every refresh, so the key is
`BIGINT GENERATED ALWAYS AS IDENTITY` (ADR-0010). The token the client holds is
an opaque random string; only its hash is stored, so a database leak does not
hand over live sessions.
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
)
from sqlalchemy.orm import Mapped, mapped_column

from beff.db.base import Base, sql_value_list

__all__ = ["REVOKED_REASONS", "RefreshToken"]

# Why a token stopped being usable. `reuse_detected` is the interesting one: it
# marks every token in a family that was revoked because a spent token from that
# family was presented again.
REVOKED_REASONS: Final = ("logout", "reuse_detected")

TOKEN_HASH_LENGTH: Final = 64  # SHA-256, hex-encoded.


class RefreshToken(Base):
    """One issued refresh token.

    A *family* is the chain of tokens descending from a single login. Rotation
    issues a new row in the same family and stamps `used_at` on the old one.
    Presenting a row that already has `used_at` means either a benign two-tab
    race (inside the grace window) or a stolen token — and since the two are
    indistinguishable after the window, the whole family is revoked.

    `created_at`/`updated_at` are deliberately absent: `issued_at` is the
    creation time and the row is only ever stamped, never edited.
    """

    __tablename__ = "refresh_tokens"
    __table_args__ = (
        CheckConstraint(
            f"length(token_hash) = {TOKEN_HASH_LENGTH}",
            name="token_hash_length",
        ),
        CheckConstraint("expires_at > issued_at", name="expires_after_issue"),
        CheckConstraint(
            f"revoked_reason IS NULL OR revoked_reason IN {sql_value_list(REVOKED_REASONS)}",
            name="revoked_reason_allowed",
        ),
        CheckConstraint(
            "revoked_reason IS NULL OR revoked_at IS NOT NULL",
            name="revoked_reason_requires_revoked_at",
        ),
        # Every foreign key gets an index — PostgreSQL does not create one, and
        # without it every cascade delete and every "sessions for this user"
        # lookup is a sequential scan.
        Index("ix_refresh_tokens_user_id", "user_id"),
        # Reuse detection revokes by family, so the family must be indexed.
        Index("ix_refresh_tokens_family_id", "family_id"),
        Index("uq_refresh_tokens_token_hash", "token_hash", unique=True),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)

    user_id: Mapped[UUID] = mapped_column(
        Uuid(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Shared by every token descended from one login. Not a foreign key: the
    # family has no row of its own, it is the login itself.
    family_id: Mapped[UUID] = mapped_column(Uuid(), nullable=False)

    token_hash: Mapped[str] = mapped_column(Text(), nullable=False)

    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[str | None] = mapped_column(Text(), nullable=True)

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<RefreshToken id={self.id} family={self.family_id!s} used={self.is_used}>"
