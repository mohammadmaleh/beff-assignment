"""The `process_measurements` table - a reading against its specification window."""

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

__all__ = ["PARAMETERS", "ProcessMeasurement"]

# The parameters the product tracks against a tolerance band. Ranges in
# CONTEXT.md; the limits live on the row because they are set per line, not
# globally.
PARAMETERS: Final = (
    "porosity_pct",
    "areal_loading_mg_cm2",
    "energy_density_wh_kg",
    "coating_thickness_um",
)


class ProcessMeasurement(Base, TimestampMixin):
    """One measured value and the window it was judged against.

    The limits are stored alongside the reading rather than looked up. A spec
    window that is changed later must not silently reclassify a historical
    measurement as in-spec - the certificate said what it said on the day.
    """

    __tablename__ = "process_measurements"
    __table_args__ = (
        CheckConstraint(f"parameter IN {sql_value_list(PARAMETERS)}", name="parameter_allowed"),
        CheckConstraint("lower_limit < upper_limit", name="limits_ordered"),
        CheckConstraint(
            "target_value IS NULL OR (target_value >= lower_limit AND target_value <= upper_limit)",
            name="target_within_limits",
        ),
        CheckConstraint("length(unit) <= 20", name="unit_length"),
        Index("ix_process_measurements_batch_id", "batch_id"),
        Index("uq_process_measurements_batch_id_parameter", "batch_id", "parameter", unique=True),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)

    batch_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("batches.id", ondelete="CASCADE"),
        nullable=False,
    )

    parameter: Mapped[str] = mapped_column(Text(), nullable=False)

    value: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    lower_limit: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    upper_limit: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    target_value: Mapped[Decimal | None] = mapped_column(Numeric(10, 3), nullable=True)

    unit: Mapped[str] = mapped_column(Text(), nullable=False)
