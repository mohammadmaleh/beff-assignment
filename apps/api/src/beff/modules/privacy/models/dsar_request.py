"""The `dsar_requests` table — the register of data subject requests.

Art. 12(3) gives the controller **one month** to answer a data subject request.
Meeting that deadline is not the interesting part; being able to *show* that it
was met is, because a supervisory authority asks for the register, not for the
answer. So every access request and every erasure is written here with the date
it arrived, the date it falls due, and the date it was answered.

This is deliberately separate from `export_jobs`. That table is queue mechanics
— attempts, payloads, dead letters — and it gets deleted when the data subject
is erased, because it contains their data. This one is the legal record and
survives erasure, holding nothing but a pseudonymous user id and three dates.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Final
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from beff.core.ids import uuid7
from beff.db.base import Base, sql_value_list, utcnow

__all__ = ["DSAR_KINDS", "DSAR_RESPONSE_DEADLINE", "DsarRequest"]

# `access` covers Art. 15 and Art. 20 together — one export answers both, and
# splitting them would mean two rows for one thing the subject asked for once.
DSAR_KINDS: Final = ("access", "erasure")

# Art. 12(3). A calendar month is not 30 days, but 30 days is always inside one,
# so the deadline this computes is never later than the one the law sets.
DSAR_RESPONSE_DEADLINE: Final = timedelta(days=30)


class DsarRequest(Base):
    """One request, and whether it was answered in time.

    Never exposed in a URL today, but it is the kind of record a support tool
    will address directly and a case reference that leaks an ordering is a leak
    of request volume — so UUIDv7, per ADR-0010 and the README's table listing.
    """

    __tablename__ = "dsar_requests"
    __table_args__ = (
        CheckConstraint(f"kind IN {sql_value_list(DSAR_KINDS)}", name="kind_allowed"),
        CheckConstraint("due_at > received_at", name="due_after_received"),
        CheckConstraint(
            "completed_at IS NULL OR completed_at >= received_at",
            name="completed_after_received",
        ),
        Index("ix_dsar_requests_user_id", "user_id"),
        # The only operational query: what is still open, oldest first. Partial,
        # because an answered request is never chased.
        Index("ix_dsar_requests_due_at", "due_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True, default=uuid7)

    # Survives erasure by design: the user row is soft-deleted and scrubbed, so
    # this id identifies nobody once erasure has run, and the register still
    # proves the request was answered.
    user_id: Mapped[UUID] = mapped_column(
        Uuid(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    kind: Mapped[str] = mapped_column(Text(), nullable=False)

    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def is_open(self) -> bool:
        return self.completed_at is None

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<DsarRequest id={self.id!s} kind={self.kind!r} open={self.is_open}>"
