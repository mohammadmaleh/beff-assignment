"""The waitlist HTTP surface — one unauthenticated endpoint."""

from __future__ import annotations

from fastapi import APIRouter, status

from beff.modules.waitlist.dependencies import Service
from beff.modules.waitlist.schemas import JoinWaitlistRequest, WaitlistEntryResponse

__all__ = ["router"]

router = APIRouter(prefix="/api/v1/waitlist", tags=["waitlist"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=WaitlistEntryResponse,
    summary="Join the waiting list",
    responses={
        409: {"description": "That address is already on the list."},
        422: {"description": "Validation errors, keyed by `email` and `company`."},
    },
)
async def join(payload: JoinWaitlistRequest, service: Service) -> WaitlistEntryResponse:
    """Deliberately unauthenticated — this is the landing page's only endpoint.

    That makes it the app's one anonymous write, and therefore the first thing
    that needs rate limiting. It is on the debt register for ENG-41 rather than
    silently assumed to be fine.
    """
    entry = await service.join(email=payload.email, company=payload.company)
    return WaitlistEntryResponse.model_validate(entry)
