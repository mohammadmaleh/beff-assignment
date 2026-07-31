"""The `scrap_events` table — where a batch lost cells, and what it cost."""

from __future__ import annotations

from decimal import Decimal
from typing import Final

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Identity,
    Index,
    Numeric,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from beff.db.base import Base, TimestampMixin, sql_value_list

__all__ = ["PROCESS_STEPS", "ScrapEvent"]

# Ordered. The order is economic, not alphabetical: scrap discovered at
# `formation` has absorbed every upstream cost, which is why the dashboard never
# sorts this breakdown by magnitude. Keys are exactly CONTEXT.md's — prose
# variants like `dieCut` are a bug.
PROCESS_STEPS: Final = (
    "mixing",
    "coating",
    "drying",
    "calendering",
    "slitting",
    "die_cutting",
    "stacking",
    "welding",
    "filling",
    "formation",
    "aging",
    "eol_test",
)


class ScrapEvent(Base, TimestampMixin):
    """Cells lost at one process step of one batch.

    `committed_value_eur` is the point of the table. A 2% loss at calendering
    and a 2% loss at formation are not the same event, and a dashboard that
    reports both as "2%" is telling the reader the wrong thing. Storing the
    committed value rather than deriving it keeps the historical cost basis
    correct when material prices move.
    """

    __tablename__ = "scrap_events"
    __table_args__ = (
        CheckConstraint(
            f"process_step IN {sql_value_list(PROCESS_STEPS)}",
            name="process_step_allowed",
        ),
        CheckConstraint("cells_scrapped >= 0", name="cells_scrapped_non_negative"),
        CheckConstraint("committed_value_eur >= 0", name="committed_value_non_negative"),
        Index("ix_scrap_events_batch_id", "batch_id"),
        Index("uq_scrap_events_batch_id_step", "batch_id", "process_step", unique=True),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)

    batch_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("batches.id", ondelete="CASCADE"),
        nullable=False,
    )

    process_step: Mapped[str] = mapped_column(Text(), nullable=False)

    cells_scrapped: Mapped[int] = mapped_column(BigInteger, nullable=False)

    committed_value_eur: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
