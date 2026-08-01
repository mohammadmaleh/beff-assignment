"""The waitlist HTTP surface — one unauthenticated endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from beff.modules.waitlist.dependencies import Service, waitlist_rate_limit
from beff.modules.waitlist.schemas import JoinWaitlistRequest, WaitlistEntryResponse

__all__ = ["router"]

router = APIRouter(prefix="/api/v1/waitlist", tags=["waitlist"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=WaitlistEntryResponse,
    summary="Join the waiting list",
    dependencies=[Depends(waitlist_rate_limit)],
    responses={
        409: {"description": "That address is already on the list."},
        422: {"description": "Validation errors, keyed by `email` and `company`."},
        429: {
            "description": (
                "Five signups per hour per origin. `extra.retry_after_seconds` "
                "says when to come back."
            )
        },
    },
)
async def join(payload: JoinWaitlistRequest, service: Service) -> WaitlistEntryResponse:
    """Deliberately unauthenticated — this is the landing page's only endpoint.

    That also makes it the app's one anonymous write, which is why it is the
    only route carrying a rate limit. The limiter counts against a salted hash
    of the caller's IP; the address itself is never stored.
    """
    entry = await service.join(email=payload.email, company=payload.company)
    return WaitlistEntryResponse.model_validate(entry)
