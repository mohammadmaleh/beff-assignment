"""What the onboarding service needs from storage, and nothing more."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from beff.modules.onboarding.models import Line, OnboardingProgress, Plant

__all__ = ["OnboardingRepository", "SetupRepository"]


class OnboardingRepository(Protocol):
    """The user's wizard state. Exactly one row per user, or none yet."""

    async def get_for_user(self, user_id: UUID) -> OnboardingProgress | None: ...

    async def upsert(self, progress: OnboardingProgress) -> OnboardingProgress: ...


class SetupRepository(Protocol):
    """The plant and line that completing the wizard creates.

    Separate from `OnboardingRepository` because these outlive onboarding: they
    are production data, and the wizard is only the first way they get created.
    """

    async def add_plant(self, plant: Plant) -> Plant: ...

    async def add_line(self, line: Line) -> Line: ...

    async def first_line_for_user(self, user_id: UUID) -> Line | None: ...
