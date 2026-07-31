"""Wiring: session -> repositories -> service -> router.

The router asks for `Service` and never constructs one, so a test can override
this and hand it a service backed by fakes without the router knowing.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from beff.db import get_session
from beff.modules.onboarding.repository import (
    PostgresOnboardingRepository,
    PostgresSetupRepository,
)
from beff.modules.onboarding.service import OnboardingService

__all__ = ["Service", "get_onboarding_service"]


def get_onboarding_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> OnboardingService:
    return OnboardingService(
        PostgresOnboardingRepository(session),
        PostgresSetupRepository(session),
    )


Service = Annotated[OnboardingService, Depends(get_onboarding_service)]
