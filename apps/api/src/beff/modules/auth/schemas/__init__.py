"""Request and response shapes for the auth module.

These are the API contract. `packages/api-client` is generated from the OpenAPI
schema they produce, so a change here is a change to the frontend's types.
"""

from beff.modules.auth.schemas.requests import LoginRequest, RegisterRequest
from beff.modules.auth.schemas.responses import SessionResponse, UserResponse

__all__ = ["LoginRequest", "RegisterRequest", "SessionResponse", "UserResponse"]
