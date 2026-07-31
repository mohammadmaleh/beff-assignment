"""In-memory onboarding repositories.

These ship in `src/` beside the PostgreSQL implementations because they are part
of the module's contract — the thing that makes the service testable without a
database — and because mypy then checks both against the same `Protocol`.

They imitate what the INSERT would fill in. A fake that is more permissive than
production turns green unit tests into false confidence, and that has already
cost this repo once: the auth fake left `created_at` unset and every HTTP test
failed on a 500 no unit test could see.
"""

from __future__ import annotations

from itertools import count
from uuid import UUID

from beff.db.base import utcnow
from beff.modules.onboarding.models import Line, OnboardingProgress, Plant

__all__ = ["InMemoryOnboardingRepository", "InMemorySetupRepository"]


def _stamp(row: OnboardingProgress | Plant | Line, identity: int) -> None:
    """Fill in what `INSERT` would have."""
    if getattr(row, "id", None) is None:
        row.id = identity
    now = utcnow()
    if getattr(row, "created_at", None) is None:
        row.created_at = now
    if getattr(row, "updated_at", None) is None:
        row.updated_at = now


class InMemoryOnboardingRepository:
    """An `OnboardingRepository` backed by a list."""

    def __init__(self) -> None:
        self.rows: list[OnboardingProgress] = []
        self._ids = count(1)

    async def get_for_user(self, user_id: UUID) -> OnboardingProgress | None:
        return next((row for row in self.rows if row.user_id == user_id), None)

    async def upsert(self, progress: OnboardingProgress) -> OnboardingProgress:
        existing = await self.get_for_user(progress.user_id)
        if existing is not None and existing is not progress:
            # Mirrors `uq_onboarding_progress_user_id`. Appending a second row
            # would let a service bug that creates duplicates pass unit tests
            # and fail only against a real database.
            raise ValueError(f"onboarding progress already exists for {progress.user_id!s}")
        _stamp(progress, next(self._ids))
        if existing is None:
            self.rows.append(progress)
        return progress


class InMemorySetupRepository:
    """A `SetupRepository` backed by lists."""

    def __init__(self) -> None:
        self.plants: list[Plant] = []
        self.lines: list[Line] = []
        self._plant_ids = count(1)
        self._line_ids = count(1)

    async def add_plant(self, plant: Plant) -> Plant:
        _stamp(plant, next(self._plant_ids))
        self.plants.append(plant)
        return plant

    async def add_line(self, line: Line) -> Line:
        _stamp(line, next(self._line_ids))
        self.lines.append(line)
        return line

    async def first_line_for_user(self, user_id: UUID) -> Line | None:
        plant_ids = {plant.id for plant in self.plants if plant.user_id == user_id}
        return next(
            (
                line
                for line in sorted(self.lines, key=lambda row: row.id)
                if line.plant_id in plant_ids
            ),
            None,
        )
