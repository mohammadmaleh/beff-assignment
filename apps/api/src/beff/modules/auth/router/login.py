"""`POST /login` — exchange credentials for a session."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from beff.core.config import Settings, get_settings
from beff.modules.auth.dependencies import Service
from beff.modules.auth.router.cookies import set_refresh_cookie
from beff.modules.auth.schemas import LoginRequest, SessionResponse

__all__ = ["router"]

router = APIRouter()


@router.post(
    "/login",
    status_code=status.HTTP_200_OK,
    response_model=SessionResponse,
    summary="Log in",
    responses={401: {"description": "Incorrect email or password."}},
)
async def login(
    payload: LoginRequest,
    response: Response,
    service: Service,
    settings: Annotated[Settings, Depends(get_settings)],
) -> SessionResponse:
    """Start a new token family.

    A fresh family per login, rather than reusing one, is what makes "log out
    everywhere" mean something later: revoking a family cannot take down a
    session it never belonged to.
    """
    session = await service.login(email=payload.email, password=payload.password)
    set_refresh_cookie(response, session.refresh_token, settings=settings)
    return SessionResponse.model_validate(session)
