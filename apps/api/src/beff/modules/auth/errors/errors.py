"""The failures the auth module can produce.

Note what these do *not* say. `InvalidCredentialsError` covers both "no such
account" and "wrong password", with one message, because distinguishing them
hands an attacker a free account-enumeration oracle — and the same reasoning is
why the service burns equivalent CPU time on the missing-user path.
"""

from __future__ import annotations

from beff.core.errors import AuthenticationError, ConflictError

__all__ = [
    "AccessTokenInvalidError",
    "EmailAlreadyRegisteredError",
    "InvalidCredentialsError",
    "RefreshTokenExpiredError",
    "RefreshTokenInvalidError",
    "RefreshTokenMissingError",
    "RefreshTokenReusedError",
]


class InvalidCredentialsError(AuthenticationError):
    """Wrong password, or no such account. Deliberately indistinguishable."""

    code = "auth.invalid_credentials"
    title = "Incorrect email or password"

    def __init__(self, detail: str = "Incorrect email or password.") -> None:
        super().__init__(detail)


class EmailAlreadyRegisteredError(ConflictError):
    """Registration collided with a live account.

    This one *does* leak that an address is registered, which is unavoidable:
    the alternative is silently not creating the account. The mitigation is at
    the transport layer (rate limiting), not by lying to the caller.
    """

    code = "auth.email_already_registered"
    title = "Email already registered"

    def __init__(self, detail: str = "That email address is already registered.") -> None:
        super().__init__(detail)


class RefreshTokenMissingError(AuthenticationError):
    """No refresh cookie was presented at all."""

    code = "auth.refresh_token_missing"
    title = "No session"

    def __init__(self, detail: str = "No refresh token was presented.") -> None:
        super().__init__(detail)


class RefreshTokenInvalidError(AuthenticationError):
    """The token is unknown, or its family has already been revoked."""

    code = "auth.refresh_token_invalid"
    title = "Session is no longer valid"

    def __init__(self, detail: str = "The refresh token is not valid.") -> None:
        super().__init__(detail)


class RefreshTokenExpiredError(AuthenticationError):
    """The token was genuine and has aged out. Sign in again."""

    code = "auth.refresh_token_expired"
    title = "Session expired"

    def __init__(self, detail: str = "The refresh token has expired.") -> None:
        super().__init__(detail)


class RefreshTokenReusedError(AuthenticationError):
    """A spent token was presented again, and the family has been revoked.

    Distinct from `RefreshTokenInvalidError` on purpose. The client cannot
    recover by refreshing and must sign in again, and the frontend should say
    so — "you were signed out for your security" rather than a generic error.
    """

    code = "auth.refresh_token_reused"
    title = "Session revoked"

    def __init__(
        self,
        detail: str = (
            "This session was ended because an already-used refresh token was "
            "presented again. Sign in again."
        ),
    ) -> None:
        super().__init__(detail)


class AccessTokenInvalidError(AuthenticationError):
    """The bearer token is missing, malformed, expired or wrongly signed."""

    code = "auth.access_token_invalid"
    title = "Not authenticated"

    def __init__(self, detail: str = "The access token is missing or not valid.") -> None:
        super().__init__(detail)
