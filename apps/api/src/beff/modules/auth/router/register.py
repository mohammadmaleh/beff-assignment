"""`POST /register` — create an account and sign it in."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from beff.core.config import Settings, get_settings
from beff.modules.auth.dependencies import Service, register_rate_limit
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
    response: Response,
    service: Service,
    settings: Annotated[Settings, Depends(get_settings)],
) -> SessionResponse:
    """Create the account and return a session in one round trip.

    Registering then making the user log in is a second chance to lose them for
    no security gain — the credentials were just verified by being chosen.
    """
    session = await service.register(
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
    )
    set_refresh_cookie(response, session.refresh_token, settings=settings)
    return SessionResponse.model_validate(session)
