"""`POST /refresh` — rotate the refresh token, mint a new access token."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response, status

from beff.core.config import Settings, get_settings
from beff.modules.auth.dependencies import Service
from beff.modules.auth.errors import RefreshTokenMissingError
from beff.modules.auth.router.cookies import REFRESH_COOKIE_NAME, set_refresh_cookie
from beff.modules.auth.schemas import SessionResponse

__all__ = ["router"]

router = APIRouter()


@router.post(
    "/refresh",
    status_code=status.HTTP_200_OK,
    response_model=SessionResponse,
    summary="Rotate the session",
    responses={
        401: {
            "description": (
                "No cookie, an expired token, or — with code "
                "`auth.refresh_token_reused` — a replayed token, in which case "
                "the whole family has been revoked and the user must sign in "
                "again."
            )
        }
    },
)
async def refresh(
    response: Response,
    service: Service,
    settings: Annotated[Settings, Depends(get_settings)],
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)] = None,
) -> SessionResponse:
    """Spend the presented token and issue its successor.

    The token arrives as a cookie and never as a body field: a body field would
    mean JavaScript could read it, which is the exact property the httpOnly
    cookie exists to deny (ADR-0003).

    Replaying a spent token revokes the entire family — see
    `RefreshTokenService.rotate`. That is the detection, and it is the reason
    rotation is worth doing at all.
    """
    if refresh_token is None:
        raise RefreshTokenMissingError

    session = await service.refresh(refresh_token)
    set_refresh_cookie(response, session.refresh_token, settings=settings)
    return SessionResponse.model_validate(session)
