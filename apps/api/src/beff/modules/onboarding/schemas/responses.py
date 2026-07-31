"""Outbound onboarding payloads."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from beff.modules.onboarding.models import ONBOARDING_STEPS
from beff.modules.onboarding.service import OnboardingService

__all__ = ["OnboardingResponse"]


class OnboardingResponse(BaseModel):
    """The whole wizard state, in one shape the client can render from cold.

    `steps` and `missing` are sent rather than hard-coded in the client so that
    adding a step is a backend change. A client with its own copy of the step
    list is a client that disagrees with the server about where the user is.
    """

    model_config = ConfigDict(from_attributes=True)

    current_step: str
    answers: dict[str, Any]
    completed_at: datetime | None
    steps: list[str] = Field(default_factory=lambda: list(ONBOARDING_STEPS))
    missing: list[str] = Field(default_factory=list)

    @classmethod
    def of(cls, progress: Any) -> OnboardingResponse:
        return cls(
            current_step=progress.current_step,
            answers=progress.answers,
            completed_at=progress.completed_at,
            steps=list(ONBOARDING_STEPS),
            missing=OnboardingService.missing_answers(progress.answers),
        )
