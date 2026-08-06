"""The onboarding HTTP surface.

Three endpoints, small enough to stay in one file - unlike auth, they share a
single response model and differ only in verb.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from beff.modules.auth.dependencies import CurrentUser
from beff.modules.onboarding.dependencies import Service
from beff.modules.onboarding.schemas import OnboardingResponse, SaveProgressRequest

__all__ = ["router"]

router = APIRouter(prefix="/api/v1/onboarding", tags=["onboarding"])


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    response_model=OnboardingResponse,
    summary="Where the user is in the wizard",
)
async def get_progress(user: CurrentUser, service: Service) -> OnboardingResponse:
    """Always returns a state, creating an empty one on a first visit.

    Returning 404 for "not started" would give the client two shapes to handle
    for one situation. "Not started" is step `role` with no answers.
    """
    return OnboardingResponse.of(await service.get(user.id))


@router.put(
    "",
    status_code=status.HTTP_200_OK,
    response_model=OnboardingResponse,
    summary="Save progress",
    responses={409: {"description": "Onboarding has already been completed."}},
)
async def save_progress(
    payload: SaveProgressRequest, user: CurrentUser, service: Service
) -> OnboardingResponse:
    """Persist the position and the answers after every step.

    This is what makes the wizard resumable across devices and across a browser
    crash - the server, not the client, owns where the user is.
    """
    progress = await service.save(
        user.id,
        current_step=payload.current_step,
        answers=payload.truncated_answers,
    )
    return OnboardingResponse.of(progress)


@router.post(
    "/complete",
    status_code=status.HTTP_200_OK,
    response_model=OnboardingResponse,
    summary="Finish onboarding",
    responses={
        409: {"description": "Onboarding has already been completed."},
        422: {"description": "Required answers are still missing; `missing` names them."},
    },
)
async def complete(user: CurrentUser, service: Service) -> OnboardingResponse:
    """Turn the answers into a plant and a line, and close the wizard."""
    return OnboardingResponse.of(await service.complete(user.id))
