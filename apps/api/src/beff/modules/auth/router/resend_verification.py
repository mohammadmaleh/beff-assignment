"""`POST /verify-email/resend` — ask for another confirmation link."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status

from beff.modules.auth.dependencies import (
    CurrentUser,
    VerificationService,
    resend_verification_rate_limit,
    resolve_email_locale,
)
from beff.modules.auth.schemas import ResendVerificationRequest, ResendVerificationResponse

__all__ = ["router"]

router = APIRouter()


@router.post(
    "/verify-email/resend",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=ResendVerificationResponse,
    summary="Send another confirmation email",
    dependencies=[Depends(resend_verification_rate_limit)],
    responses={
        401: {"description": "Missing, malformed or expired access token."},
        409: {"description": "That address is already confirmed."},
        429: {"description": "Three resends per hour per origin."},
    },
)
async def resend_verification(
    payload: ResendVerificationRequest,
    request: Request,
    user: CurrentUser,
    service: VerificationService,
) -> ResendVerificationResponse:
    """Queue a fresh link for the caller's own address.

    Authenticated, and takes no address. An endpoint that accepted one would
    tell any account holder whether a *given* address is registered and
    unconfirmed, and would let them point our sending reputation at it.

    202, not 200: the message goes on the outbox and a worker sends it, so at
    the moment this answers nothing has been delivered and claiming otherwise
    would be a lie the client repeats to the user.
    """
    locale = resolve_email_locale(
        payload.locale, accept_language=request.headers.get("accept-language")
    )
    delivery = await service.resend(user, locale=locale)
    return ResendVerificationResponse(queued=True, recipient=delivery.recipient)
