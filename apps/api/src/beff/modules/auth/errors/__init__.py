"""Auth-specific failures.

Each carries a stable `code` under the `auth.` namespace so the frontend can
render an EN or DE message without parsing English prose.
"""

from beff.modules.auth.errors.errors import (
    AccessTokenInvalidError,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    RefreshTokenExpiredError,
    RefreshTokenInvalidError,
    RefreshTokenMissingError,
    RefreshTokenReusedError,
)

__all__ = [
    "AccessTokenInvalidError",
    "EmailAlreadyRegisteredError",
    "InvalidCredentialsError",
    "RefreshTokenExpiredError",
    "RefreshTokenInvalidError",
    "RefreshTokenMissingError",
    "RefreshTokenReusedError",
]
