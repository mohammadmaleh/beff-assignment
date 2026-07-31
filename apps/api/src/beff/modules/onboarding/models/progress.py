"""The `onboarding_progress` table — resumable wizard state, one row per user."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Final
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
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from beff.db.base import Base, TimestampMixin, sql_value_list

__all__ = ["ONBOARDING_STEPS", "OnboardingProgress"]

# The wizard captures role, plant and line setup, and units (CONTEXT.md,
# "Product terms"). `review` is the confirmation screen, not a question.
ONBOARDING_STEPS: Final = ("role", "plant", "lines", "units", "review")


class OnboardingProgress(Base, TimestampMixin):
    """Where a user got to in onboarding, and what they answered.

    Internal and never addressed by id, so `BIGINT GENERATED ALWAYS AS IDENTITY`
    (ADR-0010). The row is found by `user_id`, which is unique.

    Answers are JSONB rather than columns because the wizard's question set is
    the least settled thing in the product — every added question would
    otherwise be a migration. Once a value is load-bearing for a query (plant
    name, line count) it gets promoted to a real table, which is exactly what
    `plants` and `lines` are.
    """

    __tablename__ = "onboarding_progress"
    __table_args__ = (
        CheckConstraint(
            f"current_step IN {sql_value_list(ONBOARDING_STEPS)}",
            name="current_step_allowed",
        ),
        CheckConstraint("jsonb_typeof(answers) = 'object'", name="answers_is_object"),
        Index("uq_onboarding_progress_user_id", "user_id", unique=True),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)

    user_id: Mapped[UUID] = mapped_column(
        Uuid(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    current_step: Mapped[str] = mapped_column(Text(), nullable=False, server_default=text("'role'"))

    answers: Mapped[dict[str, Any]] = mapped_column(
        JSONB(), nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )

    # NULL until the wizard is finished. Presence, not a boolean, so "when did
    # they finish" is answerable without a second column.
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def is_complete(self) -> bool:
        return self.completed_at is not None
