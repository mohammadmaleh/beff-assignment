"""PostgreSQL implementations of the onboarding repositories."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from beff.modules.onboarding.models import Line, OnboardingProgress, Plant

__all__ = ["PostgresOnboardingRepository", "PostgresSetupRepository"]


class PostgresOnboardingRepository:
    """Satisfies `OnboardingRepository` structurally - note the absent base class."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_for_user(self, user_id: UUID) -> OnboardingProgress | None:
        result = await self._session.execute(
            select(OnboardingProgress).where(OnboardingProgress.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def upsert(self, progress: OnboardingProgress) -> OnboardingProgress:
        """Add if new, flush either way.

        `uq_onboarding_progress_user_id` is what actually guarantees one row per
        user; this is the courtesy that keeps the common path off the error
        handler.
        """
        if progress not in self._session:
            self._session.add(progress)
        await self._session.flush()
        return progress


class PostgresSetupRepository:
    """Satisfies `SetupRepository` structurally."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add_plant(self, plant: Plant) -> Plant:
        self._session.add(plant)
        await self._session.flush()
        return plant

    async def add_line(self, line: Line) -> Line:
        self._session.add(line)
        await self._session.flush()
        return line

    async def first_line_for_user(self, user_id: UUID) -> Line | None:
        """The line the dashboard defaults to.

        Ordered by id so the answer is stable - "the first line they set up",
        not "whichever row the planner returned first". An unordered LIMIT 1 is
        a bug that only shows up once the table is big enough to be scanned in a
        different order.
        """
        result = await self._session.execute(
            select(Line)
            .join(Plant, Line.plant_id == Plant.id)
            .where(Plant.user_id == user_id)
            .order_by(Line.id)
            .limit(1)
        )
        return result.scalar_one_or_none()
