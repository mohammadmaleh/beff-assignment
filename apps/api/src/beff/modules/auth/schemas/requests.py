"""Inbound payloads.

Validation here is about *shape*. Anything requiring knowledge of stored state -
"is this email taken" - is a business rule and belongs in the service.
"""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from beff.modules.auth.emails import EmailLocale

__all__ = [
    "LoginRequest",
    "RegisterRequest",
    "ResendVerificationRequest",
    "VerifyEmailRequest",
]

# The verification token is 32 random bytes as url-safe base64. Bounded so a
# multi-megabyte body cannot reach the hash function, and floored so an obvious
# non-token is rejected as a shape error rather than costing a database lookup.
VERIFICATION_TOKEN_MIN_LENGTH = 20
VERIFICATION_TOKEN_MAX_LENGTH = 200

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

    # Which language the verification mail is written in. Optional rather than
    # required, and `None` rather than `"en"`: an absent value means "you
    # decide", and the router decides by content negotiation on
    # `Accept-Language`. A literal default here would be a silent guess, which
    # is exactly how a German-speaking user gets an English email.
    locale: EmailLocale | None = Field(
        default=None,
        description=(
            "Language for the confirmation email. Negotiated from Accept-Language if omitted."
        ),
    )

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        """Lower-case the address so `Ada@X` and `ada@x` are one account.

        Done once, here, rather than at every call site - the partial unique
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


class VerifyEmailRequest(BaseModel):
    """Redeem a confirmation link.

    A POST with the token in the body, not a GET with it in the path. Three
    reasons, and the third is the one that decides it: a GET is retried by
    proxies and prefetched by mail clients, tokens in a URL end up in server
    logs and `Referer` headers, and a GET that changes state is wrong anyway.
    The page reads the token out of the query string and posts it.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    token: Annotated[
        str,
        Field(
            min_length=VERIFICATION_TOKEN_MIN_LENGTH,
            max_length=VERIFICATION_TOKEN_MAX_LENGTH,
        ),
    ]


class ResendVerificationRequest(BaseModel):
    """Ask for another confirmation link.

    No email field: the address is the authenticated caller's own. Taking one
    from the body would make this an oracle that reports, to anyone with any
    account, whether a *given* address is registered and unconfirmed.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    locale: EmailLocale | None = Field(
        default=None,
        description=(
            "Language for the confirmation email. Negotiated from Accept-Language if omitted."
        ),
    )
