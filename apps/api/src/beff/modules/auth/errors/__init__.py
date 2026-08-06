"""Auth-specific failures.

Each carries a stable `code` under the `auth.` namespace so the frontend can
render an EN or DE message without parsing English prose.
"""

from beff.modules.auth.errors.errors import (
    AccessTokenInvalidError,
    EmailAlreadyRegisteredError,
    EmailAlreadyVerifiedError,
    InvalidCredentialsError,
    RefreshTokenExpiredError,
    RefreshTokenInvalidError,
    RefreshTokenMissingError,
    RefreshTokenReusedError,
    VerificationTokenExpiredError,
    VerificationTokenInvalidError,
)

__all__ = [
    "AccessTokenInvalidError",
    "EmailAlreadyRegisteredError",
    "EmailAlreadyVerifiedError",
    "InvalidCredentialsError",
    "RefreshTokenExpiredError",
    "RefreshTokenInvalidError",
    "RefreshTokenMissingError",
    "RefreshTokenReusedError",
    "VerificationTokenExpiredError",
    "VerificationTokenInvalidError",
]
