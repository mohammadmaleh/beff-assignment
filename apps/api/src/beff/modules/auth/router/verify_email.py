"""`POST /verify-email` — redeem a confirmation link."""

from __future__ import annotations

from fastapi import APIRouter, status

from beff.modules.auth.dependencies import VerificationService
from beff.modules.auth.schemas import EmailVerificationResponse, UserResponse, VerifyEmailRequest

__all__ = ["router"]

router = APIRouter()


@router.post(
    "/verify-email",
    status_code=status.HTTP_200_OK,
    response_model=EmailVerificationResponse,
    summary="Confirm an email address",
    responses={
        422: {"description": "The link is unknown, already used, or expired."},
    },
)
async def verify_email(
    payload: VerifyEmailRequest,
    service: VerificationService,
) -> EmailVerificationResponse:
    """Stamp the address as confirmed.

    Unauthenticated on purpose. The link is followed from a mail client, which
    may not be on the device that registered and will not carry the session
    cookie — requiring auth here would mean the most common path (read mail on a
    phone, registered on a laptop) is the one that fails. The token *is* the
    credential, and it is single-use and short-lived precisely so it can be.

    Note what this does not do: it does not sign the caller in. A link that
    arrives by email and produces a session is a login bypass — anyone with read
    access to the inbox, including a forwarding rule nobody remembers, would get
    one.
    """
    user = await service.verify(payload.token)
    return EmailVerificationResponse(verified=True, user=UserResponse.model_validate(user))
