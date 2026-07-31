"""Wiring: session -> repositories -> services -> router.

This is the only file in the module that knows both how a service is built and
how a request supplies its parts. The router asks for `Service`; it never
constructs one, so a test can override the dependency and hand it a service
backed by fakes.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from beff.core.config import Settings, get_settings
from beff.db import get_session
from beff.modules.auth.errors import AccessTokenInvalidError
from beff.modules.auth.models import User
from beff.modules.auth.repository import (
    PostgresRefreshTokenRepository,
    PostgresUserRepository,
)
from beff.modules.auth.service import AuthService, RefreshTokenService

__all__ = ["CurrentUser", "Service", "get_auth_service", "get_current_user"]

BEARER_PREFIX = "Bearer "


def get_auth_service(
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthService:
    """Assemble an `AuthService` for this request."""
    return AuthService(
        PostgresUserRepository(session),
        RefreshTokenService(
            PostgresRefreshTokenRepository(session),
            ttl_seconds=settings.refresh_token_ttl_seconds,
            grace_seconds=settings.refresh_token_grace_seconds,
        ),
        jwt_secret=settings.jwt_secret,
        jwt_algorithm=settings.jwt_algorithm,
        access_token_ttl_seconds=settings.access_token_ttl_seconds,
    )


Service = Annotated[AuthService, Depends(get_auth_service)]


async def get_current_user(request: Request, service: Service) -> User:
    """Resolve the `Authorization: Bearer` header to a live user.

    Deliberately not FastAPI's `OAuth2PasswordBearer`: that helper raises its
    own `HTTPException` with its own body shape, which would put one endpoint's
    401 outside the RFC 9457 envelope every other error uses. Raising the
    domain error instead keeps every failure on one path.
    """
    header = request.headers.get("authorization", "")
    if not header.startswith(BEARER_PREFIX):
        raise AccessTokenInvalidError

    token = header[len(BEARER_PREFIX) :].strip()
    if not token:
        raise AccessTokenInvalidError

    return await service.authenticate_access_token(token)


CurrentUser = Annotated[User, Depends(get_current_user)]
