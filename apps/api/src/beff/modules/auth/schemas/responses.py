"""Outbound payloads.

The refresh token is conspicuously absent from every one of these: it travels
only as an httpOnly cookie, so that no JavaScript - injected or otherwise - can
read it (ADR-0003).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "EmailVerificationResponse",
    "ResendVerificationResponse",
    "SessionResponse",
    "UserResponse",
]


class UserResponse(BaseModel):
    """A user as the owner of that account sees themselves.

    No `password_hash`, and no `deleted_at` - the first is a credential and the
    second is internal bookkeeping.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    role: str
    created_at: datetime

    # `None` until the address is confirmed. Exposed as the timestamp rather
    # than a boolean because the frontend has it either way and a date is what
    # the profile screen shows; `email_verified_at !== null` is the boolean.
    email_verified_at: datetime | None = None


class SessionResponse(BaseModel):
    """What register, login and refresh all return."""

    model_config = ConfigDict(from_attributes=True)

    access_token: str
    token_type: str = Field(default="bearer", description="Always `bearer`, per RFC 6750.")
    expires_in: int = Field(description="Access-token lifetime in seconds.")
    user: UserResponse


class EmailVerificationResponse(BaseModel):
    """The outcome of redeeming a link.

    Carries the user, so the profile screen can update without a second round
    trip - and so a caller who was already signed in when they followed the link
    sees the new state immediately rather than after the next refresh.
    """

    model_config = ConfigDict(from_attributes=True)

    verified: bool = Field(description="Always `true`; a failure is a problem response, not this.")
    user: UserResponse


class ResendVerificationResponse(BaseModel):
    """Acknowledgement that a message is queued.

    Not "sent". The outbox is drained by a worker, so the API cannot honestly
    claim delivery at the moment it answers - and a client that shows "sent"
    against a queue that later dead-letters has told the user something false.
    """

    model_config = ConfigDict(from_attributes=True)

    queued: bool = Field(description="Always `true`; the message is on the queue, not yet sent.")
    recipient: str = Field(description="The address it will go to - the caller's own.")
