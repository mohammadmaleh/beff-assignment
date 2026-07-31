"""Outbound waitlist payloads."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

__all__ = ["WaitlistEntryResponse"]


class WaitlistEntryResponse(BaseModel):
    """Confirmation that the signup landed.

    The email is echoed back so the client can show *which* address it was sent
    to, which is the one thing someone who mistyped needs to see. Nothing else
    about the row is exposed — the id is internal and there is no endpoint that
    takes it.
    """

    model_config = ConfigDict(from_attributes=True)

    email: str
    company: str
    created_at: datetime
