"""Inbound waitlist payloads."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from beff.modules.waitlist.models import COMPANY_MAX_LENGTH, EMAIL_MAX_LENGTH

__all__ = ["JoinWaitlistRequest"]


class JoinWaitlistRequest(BaseModel):
    """A pre-launch signup.

    The field names match what the landing form posts, and the validation errors
    come back keyed by them so the client can render an inline message against
    the right input.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: Annotated[EmailStr, Field(max_length=EMAIL_MAX_LENGTH)]
    company: Annotated[str, Field(min_length=1, max_length=COMPANY_MAX_LENGTH)]
