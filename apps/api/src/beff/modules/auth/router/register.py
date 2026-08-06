"""`POST /register` — create an account, sign it in, and queue the confirmation."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from beff.core.config import Settings, get_settings
from beff.modules.auth.dependencies import (
    Service,
    VerificationService,
    register_rate_limit,
    resolve_email_locale,
)
from beff.modules.auth.router.cookies import set_refresh_cookie
from beff.modules.auth.schemas import RegisterRequest, SessionResponse

__all__ = ["router"]

router = APIRouter()


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=SessionResponse,
    summary="Register a new account",
    dependencies=[Depends(register_rate_limit)],
    responses={
        409: {"description": "That email address is already registered."},
        429: {"description": "Five registrations per hour per origin."},
    },
)
async def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    service: Service,
    verification: VerificationService,
    settings: Annotated[Settings, Depends(get_settings)],
) -> SessionResponse:
    """Create the account and return a session in one round trip.

    Registering then making the user log in is a second chance to lose them for
    no security gain — the credentials were just verified by being chosen.

    The confirmation email is *queued*, not sent, in this same transaction. Two
    consequences worth being explicit about: a registration that rolls back
    cannot leave a verification mail on its way to an account that does not
    exist, and a mail provider being down cannot fail a signup. The account is
    usable immediately; confirming the address is a separate, later act.
    """
    session = await service.register(
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
    )
    await verification.issue(
        session.user,
        locale=resolve_email_locale(
            payload.locale, accept_language=request.headers.get("accept-language")
        ),
    )
    set_refresh_cookie(response, session.refresh_token, settings=settings)
    return SessionResponse.model_validate(session)
