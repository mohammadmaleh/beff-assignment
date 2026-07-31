"""The resumable wizard.

The server owns which step the user is on. That is the whole design: a client
that remembers its own position resumes correctly only on the device that
recorded it, and an engineer interrupted mid-task on a factory floor is the
normal case here, not an edge one.
"""

from __future__ import annotations

from typing import Any, Final
from uuid import UUID

from beff.db.base import utcnow
from beff.modules.onboarding.errors import (
    OnboardingAlreadyCompleteError,
    OnboardingIncompleteError,
    UnknownStepError,
)
from beff.modules.onboarding.models import (
    CELL_FORMATS,
    ONBOARDING_STEPS,
    Line,
    OnboardingProgress,
    Plant,
)
from beff.modules.onboarding.repository import OnboardingRepository, SetupRepository

__all__ = ["REQUIRED_ANSWERS", "OnboardingService"]

# What each step must have collected before the wizard can finish. The client
# uses the same list to disable its own "continue" button; this is the copy that
# is authoritative, because the client's can be bypassed.
REQUIRED_ANSWERS: Final[dict[str, tuple[str, ...]]] = {
    "role": ("role",),
    "plant": ("plant_name", "plant_country"),
    "lines": ("line_name", "line_kind", "cell_format"),
    "units": ("unit_system",),
    "review": (),
}

ROLES: Final = ("process_engineer", "quality_engineer", "production_manager", "other")
LINE_KINDS: Final = ("pilot", "production")
UNIT_SYSTEMS: Final = ("metric", "imperial")


class OnboardingService:
    """Wizard use cases. Knows nothing about HTTP or SQL."""

    def __init__(self, progress: OnboardingRepository, setup: SetupRepository) -> None:
        self._progress = progress
        self._setup = setup

    async def get(self, user_id: UUID) -> OnboardingProgress:
        """The user's state, creating an empty one on first visit.

        Returning a row rather than `None` means the client has one shape to
        render. "Not started" is step `role` with no answers, which is exactly
        what a fresh row says.
        """
        existing = await self._progress.get_for_user(user_id)
        if existing is not None:
            return existing

        return await self._progress.upsert(
            OnboardingProgress(user_id=user_id, current_step=ONBOARDING_STEPS[0], answers={})
        )

    async def save(
        self, user_id: UUID, *, current_step: str, answers: dict[str, Any]
    ) -> OnboardingProgress:
        """Record where the user is and what they have answered so far.

        Answers are merged, not replaced. The client sends the whole set today,
        but a partial PATCH from a later client must not silently erase the
        answers it did not know about.
        """
        if current_step not in ONBOARDING_STEPS:
            raise UnknownStepError(current_step, ONBOARDING_STEPS)

        progress = await self.get(user_id)
        if progress.is_complete:
            raise OnboardingAlreadyCompleteError

        merged = {**progress.answers, **answers}
        progress.answers = self._clean(merged)
        progress.current_step = current_step
        return await self._progress.upsert(progress)

    async def complete(self, user_id: UUID) -> OnboardingProgress:
        """Turn the answers into a plant and a line, and close the wizard.

        This is where wizard state stops being scratch and becomes production
        data. It is deliberately not idempotent-by-ignoring: running twice would
        create a second plant and line from the same answers, and duplicate
        setup is a worse outcome than an error the client can read.
        """
        progress = await self.get(user_id)
        if progress.is_complete:
            raise OnboardingAlreadyCompleteError

        missing = self.missing_answers(progress.answers)
        if missing:
            raise OnboardingIncompleteError(missing)

        answers = progress.answers
        plant = await self._setup.add_plant(
            Plant(
                user_id=user_id,
                name=str(answers["plant_name"]).strip(),
                # The CHECK constraint is `^[A-Z]{2}$`; folding here means a
                # client sending `de` gets a plant rather than a 500.
                country_code=str(answers["plant_country"]).strip().upper()[:2],
            )
        )
        await self._setup.add_line(
            Line(
                plant_id=plant.id,
                name=str(answers["line_name"]).strip(),
                cell_format=str(answers["cell_format"]),
                # 40-80% first-pass yield is normal on a pilot line and alarming
                # on a production one. Without this flag the dashboard cannot
                # interpret its own headline number.
                is_pilot_line=answers["line_kind"] == "pilot",
            )
        )

        progress.current_step = ONBOARDING_STEPS[-1]
        progress.completed_at = utcnow()
        return await self._progress.upsert(progress)

    @staticmethod
    def missing_answers(answers: dict[str, Any]) -> list[str]:
        """Every required answer that is absent or blank, in step order."""
        missing: list[str] = []
        for step in ONBOARDING_STEPS:
            for key in REQUIRED_ANSWERS[step]:
                value = answers.get(key)
                if value is None or (isinstance(value, str) and not value.strip()):
                    missing.append(key)
        return missing

    @staticmethod
    def _clean(answers: dict[str, Any]) -> dict[str, Any]:
        """Reject values the schema's CHECK constraints would reject anyway.

        Enum-ish answers are validated here rather than trusted, because they
        become `cell_format` and `is_pilot_line` — columns with constraints — and
        an invalid value should fail as a readable validation error, not as an
        `IntegrityError` three layers down.
        """
        allowed: dict[str, tuple[str, ...]] = {
            "role": ROLES,
            "line_kind": LINE_KINDS,
            "cell_format": CELL_FORMATS,
            "unit_system": UNIT_SYSTEMS,
        }
        cleaned = dict(answers)
        for key, options in allowed.items():
            value = cleaned.get(key)
            if value is not None and value not in options:
                # Dropped rather than raised: a stale client sending one bad
                # enum should not lose the user the other four answers they just
                # typed. `complete()` will refuse while it is still missing.
                del cleaned[key]
        return cleaned
