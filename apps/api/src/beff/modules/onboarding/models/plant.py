"""The `plants` table — a physical manufacturing site (CONTEXT.md)."""

from __future__ import annotations

from typing import Final
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Identity,
    Index,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from beff.db.base import Base, TimestampMixin

__all__ = ["Plant"]

PLANT_NAME_MAX_LENGTH: Final = 120


class Plant(Base, TimestampMixin):
    """A manufacturing site belonging to the user who set it up in onboarding.

    Internal key (ADR-0010): a plant is addressed through the owning user's
    setup, never by a client-supplied id.
    """

    __tablename__ = "plants"
    __table_args__ = (
        CheckConstraint(f"length(name) <= {PLANT_NAME_MAX_LENGTH}", name="name_length"),
        CheckConstraint("length(name) > 0", name="name_not_blank"),
        # ISO 3166-1 alpha-2. Country granularity only — see `consent_records`
        # for why city-level location is never stored anywhere in this schema.
        CheckConstraint("country_code ~ '^[A-Z]{2}$'", name="country_code_iso_alpha2"),
        Index("ix_plants_user_id", "user_id"),
        Index("uq_plants_user_id_name", "user_id", "name", unique=True),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)

    user_id: Mapped[UUID] = mapped_column(
        Uuid(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(Text(), nullable=False)
    country_code: Mapped[str] = mapped_column(Text(), nullable=False)
