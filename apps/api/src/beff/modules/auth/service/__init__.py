"""Business logic for the auth module.

No class here knows what HTTP is, and none writes SQL. They take repositories by
protocol and a clock by argument, which is why the whole of rotation, reuse
detection and link expiry is covered by fast in-memory tests.
"""

from beff.modules.auth.service.auth_service import AuthenticatedSession, AuthService
from beff.modules.auth.service.token_service import IssuedRefreshToken, RefreshTokenService
from beff.modules.auth.service.verification_service import (
    VERIFICATION_PURPOSE,
    EmailVerificationService,
)

__all__ = [
    "VERIFICATION_PURPOSE",
    "AuthService",
    "AuthenticatedSession",
    "EmailVerificationService",
    "IssuedRefreshToken",
    "RefreshTokenService",
]
