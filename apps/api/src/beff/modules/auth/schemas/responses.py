"""Outbound payloads.

The refresh token is conspicuously absent from every one of these: it travels
only as an httpOnly cookie, so that no JavaScript — injected or otherwise — can
read it (ADR-0003).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

__all__ = ["SessionResponse", "UserResponse"]


class UserResponse(BaseModel):
    """A user as the owner of that account sees themselves.

    No `password_hash`, and no `deleted_at` — the first is a credential and the
    second is internal bookkeeping.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    role: str
    created_at: datetime


class SessionResponse(BaseModel):
    """What register, login and refresh all return."""

    model_config = ConfigDict(from_attributes=True)

    access_token: str
    token_type: str = Field(default="bearer", description="Always `bearer`, per RFC 6750.")
    expires_in: int = Field(description="Access-token lifetime in seconds.")
    user: UserResponse
