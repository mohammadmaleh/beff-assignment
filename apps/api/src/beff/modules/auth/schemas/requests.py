"""Inbound payloads.

Validation here is about *shape*. Anything requiring knowledge of stored state —
"is this email taken" — is a business rule and belongs in the service.
"""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

__all__ = ["LoginRequest", "RegisterRequest"]

# NIST SP 800-63B: length is the control that matters, and composition rules
# ("one uppercase, one symbol") measurably push users towards weaker, more
# guessable passwords. So: a floor of 12, no composition rules.
PASSWORD_MIN_LENGTH = 12
# Argon2 cost is linear in input length past the block size, so an unbounded
# password field is a denial-of-service vector.
PASSWORD_MAX_LENGTH = 128

EMAIL_MAX_LENGTH = 254
DISPLAY_NAME_MAX_LENGTH = 120

Password = Annotated[str, Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)]


class RegisterRequest(BaseModel):
    """A new account."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: Annotated[EmailStr, Field(max_length=EMAIL_MAX_LENGTH)]
    password: Password
    display_name: Annotated[str, Field(min_length=1, max_length=DISPLAY_NAME_MAX_LENGTH)]

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        """Lower-case the address so `Ada@X` and `ada@x` are one account.

        Done once, here, rather than at every call site — the partial unique
        index compares raw bytes and cannot fold case for us.
        """
        return value.lower()


class LoginRequest(BaseModel):
    """An existing account."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: Annotated[EmailStr, Field(max_length=EMAIL_MAX_LENGTH)]
    # No length bounds on login: rejecting a short password here would tell the
    # caller that the stored one is longer, and it would lock out any account
    # created before the policy changed.
    password: str

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        return value.lower()
