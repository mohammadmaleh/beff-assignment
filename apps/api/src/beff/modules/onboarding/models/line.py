"""The `lines` table — a production line within a plant (CONTEXT.md)."""

from __future__ import annotations

from typing import Final

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Identity,
    Index,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from beff.db.base import Base, TimestampMixin, sql_value_list

__all__ = ["CELL_FORMATS", "Line"]

# Physical form of the cell the line produces (CONTEXT.md, "Cell format").
CELL_FORMATS: Final = ("pouch", "prismatic", "cylindrical")

LINE_NAME_MAX_LENGTH: Final = 120


class Line(Base, TimestampMixin):
    """A production line. A plant has many.

    `is_pilot_line` matters for how the dashboard reads yield: 40-80% first-pass
    yield is normal on a pilot line and alarming on a production line
    (CONTEXT.md, "Metrics"). Without the flag the same number cannot be
    interpreted.
    """

    __tablename__ = "lines"
    __table_args__ = (
        CheckConstraint(f"length(name) <= {LINE_NAME_MAX_LENGTH}", name="name_length"),
        CheckConstraint("length(name) > 0", name="name_not_blank"),
        CheckConstraint(
            f"cell_format IN {sql_value_list(CELL_FORMATS)}", name="cell_format_allowed"
        ),
        Index("ix_lines_plant_id", "plant_id"),
        Index("uq_lines_plant_id_name", "plant_id", "name", unique=True),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)

    plant_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("plants.id", ondelete="CASCADE"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(Text(), nullable=False)
    cell_format: Mapped[str] = mapped_column(Text(), nullable=False)
    is_pilot_line: Mapped[bool] = mapped_column(
        Boolean(), nullable=False, server_default=text("false")
    )
