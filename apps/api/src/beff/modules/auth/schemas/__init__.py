"""Request and response shapes for the auth module.

These are the API contract. `packages/api-client` is generated from the OpenAPI
schema they produce, so a change here is a change to the frontend's types.
"""

from beff.modules.auth.schemas.requests import (
    LoginRequest,
    RegisterRequest,
    ResendVerificationRequest,
    VerifyEmailRequest,
)
from beff.modules.auth.schemas.responses import (
    EmailVerificationResponse,
    ResendVerificationResponse,
    SessionResponse,
    UserResponse,
)

__all__ = [
    "EmailVerificationResponse",
    "LoginRequest",
    "RegisterRequest",
    "ResendVerificationRequest",
    "ResendVerificationResponse",
    "SessionResponse",
    "UserResponse",
    "VerifyEmailRequest",
]
