"""The `batches` table - a production run, and the unit of traceability."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Final

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Numeric,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from beff.db.base import Base, TimestampMixin

__all__ = ["Batch"]

BATCH_CODE_MAX_LENGTH: Final = 60


class Batch(Base, TimestampMixin):
    """A production run sharing material lot and process parameters (CONTEXT.md).

    High-volume and internal, so `BIGINT GENERATED ALWAYS AS IDENTITY` rather
    than a UUID (ADR-0010). The batch *code* is the thing humans quote, and it
    is unique per line.

    Percentages are `NUMERIC` in the range 0-100, never 0-1, and every such
    column's name ends in `_pct` so the unit is unambiguous at the call site.
    `NUMERIC` rather than `DOUBLE PRECISION` because these numbers are reported
    to customers and summed into scrap costs; binary floating point drift in a
    yield figure is not acceptable.
    """

    __tablename__ = "batches"
    __table_args__ = (
        CheckConstraint(f"length(code) <= {BATCH_CODE_MAX_LENGTH}", name="code_length"),
        CheckConstraint("length(code) > 0", name="code_not_blank"),
        CheckConstraint("cells_started > 0", name="cells_started_positive"),
        CheckConstraint(
            "cells_passed_eol >= 0 AND cells_passed_eol <= cells_started",
            name="cells_passed_within_started",
        ),
        CheckConstraint(
            "capacity_retention_pct >= 0 AND capacity_retention_pct <= 100",
            name="capacity_retention_pct_range",
        ),
        CheckConstraint("co2_intensity_kg_per_kwh >= 0", name="co2_intensity_non_negative"),
        Index("ix_batches_line_id", "line_id"),
        # The dashboard's only query shape: one line, a time window, newest
        # first. A plain FK index would still force a sort.
        Index("ix_batches_line_id_started_at", "line_id", "started_at"),
        Index("uq_batches_line_id_code", "line_id", "code", unique=True),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)

    line_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("lines.id", ondelete="CASCADE"),
        nullable=False,
    )

    code: Mapped[str] = mapped_column(Text(), nullable=False)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    cells_started: Mapped[int] = mapped_column(BigInteger, nullable=False)

    # Cells passing end-of-line test **without rework**. First-pass yield is
    # this over `cells_started`; counting reworked cells as passes is the most
    # common way an FPY number gets quietly inflated.
    cells_passed_eol: Mapped[int] = mapped_column(BigInteger, nullable=False)

    # Remaining capacity after 1000 cycles, relative to initial. ~80% is a
    # common end-of-life threshold (CONTEXT.md).
    capacity_retention_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)

    # kg CO₂e per kWh produced. 40-120 depending on the grid (CONTEXT.md).
    co2_intensity_kg_per_kwh: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
