"""Registration, login, refresh, logout and access-token authentication."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

import jwt

from beff.core.security import (
    burn_equivalent_time,
    decode_access_token,
    encode_access_token,
    hash_password,
    password_needs_rehash,
    verify_password,
)
from beff.db.base import utcnow
from beff.modules.auth.errors import (
    AccessTokenInvalidError,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    RefreshTokenInvalidError,
)
from beff.modules.auth.models import User
from beff.modules.auth.repository import UserRepository
from beff.modules.auth.service.token_service import RefreshTokenService

__all__ = ["AuthService", "AuthenticatedSession"]


@dataclass(frozen=True, slots=True)
class AuthenticatedSession:
    """Everything a successful register, login or refresh produces.

    `refresh_token` is carried out of the service so the router can set it as an
    httpOnly cookie. It must never reach a response body (ADR-0003).
    """

    user: User
    access_token: str
    expires_in: int
    refresh_token: str


class AuthService:
    """Auth use cases. Knows nothing about HTTP, cookies or SQL."""

    def __init__(
        self,
        users: UserRepository,
        tokens: RefreshTokenService,
        *,
        jwt_secret: str,
        jwt_algorithm: str,
        access_token_ttl_seconds: int,
        clock: Callable[[], datetime] = utcnow,
    ) -> None:
        self._users = users
        self._tokens = tokens
        self._jwt_secret = jwt_secret
        self._jwt_algorithm = jwt_algorithm
        self._access_ttl = access_token_ttl_seconds
        self._clock = clock

    async def register(
        self, *, email: str, password: str, display_name: str
    ) -> AuthenticatedSession:
        """Create an account and sign it in immediately.

        The duplicate check here is a courtesy that produces a good error
        message; the guarantee is the partial unique index, which is the only
        thing that holds under two concurrent registrations of the same address.
        """
        normalised = self._normalise_email(email)
        if await self._users.get_active_by_email(normalised) is not None:
            raise EmailAlreadyRegisteredError

        user = await self._users.add(
            User(
                email=normalised,
                password_hash=hash_password(password),
                display_name=display_name.strip(),
                role="member",
            )
        )
        return await self._start_session(user)

    async def login(self, *, email: str, password: str) -> AuthenticatedSession:
        """Verify credentials and start a new token family."""
        user = await self._users.get_active_by_email(self._normalise_email(email))

        if user is None:
            # Hash something anyway. Returning in microseconds when no account
            # exists, and ~50 ms when one does, is a free enumeration oracle.
            burn_equivalent_time()
            raise InvalidCredentialsError

        if not verify_password(user.password_hash, password):
            raise InvalidCredentialsError

        if password_needs_rehash(user.password_hash):
            # The only moment the plaintext is available, so the only moment an
            # upgraded cost factor can be applied.
            user.password_hash = hash_password(password)

        return await self._start_session(user)

    async def refresh(self, presented_refresh_token: str) -> AuthenticatedSession:
        """Rotate the refresh token and mint a matching access token.

        Reuse detection lives in `RefreshTokenService.rotate`; if it fires, this
        method never returns.
        """
        issued = await self._tokens.rotate(presented_refresh_token)

        user = await self._users.get_active_by_id(issued.record.user_id)
        if user is None:
            # The token was valid but its owner has been erased or deactivated
            # since. Refusing here is what stops a live session outliving the
            # account it belongs to.
            await self._tokens.revoke_family_of(issued.token)
            raise RefreshTokenInvalidError

        return self._session_for(user, refresh_token=issued.token)

    async def logout(self, presented_refresh_token: str | None) -> None:
        """End the session by revoking the whole family.

        A missing cookie is not an error: logging out twice, or logging out
        without a session, should both leave the caller logged out.
        """
        if not presented_refresh_token:
            return
        await self._tokens.revoke_family_of(presented_refresh_token)

    async def authenticate_access_token(self, token: str) -> User:
        """Resolve a bearer token to its live user.

        The database is consulted for the *user*, not the token — the JWT's
        signature already proves the token, and the lookup is what makes an
        erased account stop working before its access token expires.
        """
        try:
            claims = decode_access_token(
                token, secret=self._jwt_secret, algorithm=self._jwt_algorithm
            )
        except jwt.PyJWTError as exc:
            raise AccessTokenInvalidError from exc

        user = await self._users.get_active_by_id(claims.sub)
        if user is None:
            raise AccessTokenInvalidError

        return user

    async def _start_session(self, user: User) -> AuthenticatedSession:
        """Begin a brand-new token family. Register and login both land here."""
        issued = await self._tokens.issue(user.id)
        return self._session_for(user, refresh_token=issued.token)

    def _session_for(self, user: User, *, refresh_token: str) -> AuthenticatedSession:
        access_token = encode_access_token(
            subject=user.id,
            role=user.role,
            secret=self._jwt_secret,
            algorithm=self._jwt_algorithm,
            issued_at=self._clock(),
            ttl_seconds=self._access_ttl,
        )
        return AuthenticatedSession(
            user=user,
            access_token=access_token,
            expires_in=self._access_ttl,
            refresh_token=refresh_token,
        )

    @staticmethod
    def _normalise_email(email: str) -> str:
        """Fold case and trim. The unique index compares raw bytes."""
        return email.strip().lower()
