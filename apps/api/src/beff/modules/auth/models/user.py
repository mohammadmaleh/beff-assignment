"""The `users` table.

Primary key is UUIDv7: the id appears in URLs and API responses, so it must not
be enumerable (ADR-0010).
"""

from __future__ import annotations

from datetime import datetime
from typing import Final
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, Index, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from beff.core.ids import uuid7
from beff.db.base import Base, SoftDeleteMixin, TimestampMixin, sql_value_list

__all__ = ["USER_ROLES", "User"]

# Access role, not job title. What the user *does* — process engineer, quality
# engineer, production manager (CONTEXT.md) — is captured during onboarding and
# has no bearing on authorisation, so the two are deliberately separate.
USER_ROLES: Final = ("member", "admin")

# RFC 5321 caps a forward path at 254 octets.
EMAIL_MAX_LENGTH: Final = 254
DISPLAY_NAME_MAX_LENGTH: Final = 120


class User(Base, TimestampMixin, SoftDeleteMixin):
    """A registered person.

    `email` carries no table-level UNIQUE constraint. Uniqueness is enforced by
    a *partial* unique index restricted to `deleted_at IS NULL`, so GDPR erasure
    frees the address for re-registration. A plain UNIQUE would make an erased
    account permanently block its own former owner from signing up again —
    which is itself a retention of personal data.
    """

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(f"length(email) <= {EMAIL_MAX_LENGTH}", name="email_length"),
        CheckConstraint("length(email) > 0", name="email_not_blank"),
        CheckConstraint(
            f"length(display_name) <= {DISPLAY_NAME_MAX_LENGTH}", name="display_name_length"
        ),
        CheckConstraint(f"role IN {sql_value_list(USER_ROLES)}", name="role_allowed"),
        Index(
            "uq_users_email_active",
            "email",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True, default=uuid7)

    # TEXT, never VARCHAR(n): widening a VARCHAR is a table rewrite on older
    # PostgreSQL and the length limit belongs in a CHECK where it is visible.
    email: Mapped[str] = mapped_column(Text(), nullable=False)

    # Argon2id. The parameters are embedded in the encoded hash, so raising the
    # cost later needs no schema change — only a rehash on next successful login.
    password_hash: Mapped[str] = mapped_column(Text(), nullable=False)

    display_name: Mapped[str] = mapped_column(Text(), nullable=False)

    # TEXT + CHECK, never a PostgreSQL ENUM: adding a value to a PG enum cannot
    # run inside a transaction before PG 12 and still cannot be removed at all.
    role: Mapped[str] = mapped_column(Text(), nullable=False, server_default=text("'member'"))

    # A timestamp, not a boolean. "Verified" is an event with a date — needed to
    # answer when an address was confirmed, and needed again if the policy for
    # what an unverified account may do ever changes and existing accounts have
    # to be graded by how long they have been confirmed. A boolean throws that
    # away and cannot be recovered.
    #
    # NULL means unverified, which is the correct default for every row that
    # existed before this column did: the migration cannot claim an address was
    # confirmed when nobody ever asked.
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    @property
    def is_email_verified(self) -> bool:
        return self.email_verified_at is not None

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<User id={self.id!s} role={self.role!r}>"
