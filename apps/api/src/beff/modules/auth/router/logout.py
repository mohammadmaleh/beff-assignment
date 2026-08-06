"""`POST /logout` - revoke the session family and clear the cookie."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response, status

from beff.core.config import Settings, get_settings
from beff.modules.auth.dependencies import Service
from beff.modules.auth.router.cookies import REFRESH_COOKIE_NAME, clear_refresh_cookie

__all__ = ["router"]

router = APIRouter()


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Log out",
)
async def logout(
    response: Response,
    service: Service,
    settings: Annotated[Settings, Depends(get_settings)],
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)] = None,
) -> Response:
    """Always succeeds.

    No authentication is required and a missing cookie is not an error: logging
    out twice, or logging out with an already-dead session, must both leave the
    caller logged out. Returning 401 here would leave the cookie in the browser
    on the one path where clearing it matters most.
    """
    await service.logout(refresh_token)
    clear_refresh_cookie(response, settings=settings)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
