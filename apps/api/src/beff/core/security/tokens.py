"""Access-token minting and refresh-token generation.

Two different kinds of token, deliberately:

* The **access token** is a signed JWT. It is short-lived, held in browser
  memory, and never checked against the database - that is the whole point, and
  the reason it must expire quickly, since it cannot be revoked.
* The **refresh token** is opaque: 384 bits from `secrets`, meaningless to
  anyone but the database. Only its SHA-256 is stored, so a database leak does
  not hand over live sessions.

Refresh tokens are hashed with SHA-256 rather than Argon2. Argon2 exists to make
*guessing* expensive, and there is nothing to guess in 384 bits of CSPRNG
output - while paying 64 MiB and ~50 ms on every refresh would turn the endpoint
into a denial-of-service amplifier.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta
from uuid import UUID, uuid4

import jwt
from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "AccessTokenClaims",
    "decode_access_token",
    "encode_access_token",
    "generate_refresh_token",
    "generate_verification_token",
    "hash_opaque_token",
    "hash_refresh_token",
]

# 48 bytes -> 64 url-safe characters.
_REFRESH_TOKEN_BYTES = 48

# 32 bytes -> 43 url-safe characters. Smaller than the refresh token because
# this one is pasted into a URL that a person may have to read off a screen, and
# 256 bits is already far beyond guessable for a credential that lives a day.
_VERIFICATION_TOKEN_BYTES = 32

# Pinned so a token minted for one purpose cannot be replayed as another if more
# token kinds are added later.
ACCESS_TOKEN_TYPE = "access"  # noqa: S105 - a type discriminator, not a secret


class AccessTokenClaims(BaseModel):
    """The decoded, verified payload of an access token."""

    model_config = ConfigDict(frozen=True)

    sub: UUID
    role: str
    typ: str
    jti: UUID
    iat: datetime
    exp: datetime = Field(description="Expiry, verified by the decoder before this is built.")


def generate_refresh_token() -> str:
    """A fresh opaque refresh token. Returned to the client exactly once."""
    return secrets.token_urlsafe(_REFRESH_TOKEN_BYTES)


def generate_verification_token() -> str:
    """A fresh opaque email-verification token. Shown to nobody but its owner."""
    return secrets.token_urlsafe(_VERIFICATION_TOKEN_BYTES)


def hash_opaque_token(token: str) -> str:
    """The 64-character hex SHA-256 of an opaque token - what the database stores.

    SHA-256 and not Argon2, for the same reason `hash_refresh_token` uses it:
    these tokens are 256+ bits of `secrets` output, so there is no dictionary to
    mount and no cost factor worth paying on a value that is verified on a hot
    path. Argon2 protects *low-entropy* secrets; this is not one.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_refresh_token(token: str) -> str:
    """The 64-character hex SHA-256 of a refresh token - what the database stores."""
    return hash_opaque_token(token)


def encode_access_token(
    *,
    subject: UUID,
    role: str,
    secret: str,
    algorithm: str,
    issued_at: datetime,
    ttl_seconds: int,
) -> str:
    """Mint a signed access token.

    `issued_at` is injected rather than read from the clock so the caller owns
    time and tests need no freezing library.
    """
    expires_at = issued_at + timedelta(seconds=ttl_seconds)
    payload = {
        "sub": str(subject),
        "role": role,
        "typ": ACCESS_TOKEN_TYPE,
        "jti": str(uuid4()),
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def decode_access_token(token: str, *, secret: str, algorithm: str) -> AccessTokenClaims:
    """Verify and decode an access token.

    Raises `jwt.PyJWTError` on anything wrong - bad signature, expired, wrong
    algorithm, missing claim. The algorithm is passed as an allow-list of
    exactly one, which is what stops the `alg: none` and
    RS256-verified-as-HS256 confusion attacks.
    """
    payload = jwt.decode(
        token,
        secret,
        algorithms=[algorithm],
        options={"require": ["exp", "iat", "sub", "jti"]},
    )
    if payload.get("typ") != ACCESS_TOKEN_TYPE:
        raise jwt.InvalidTokenError(f"expected typ={ACCESS_TOKEN_TYPE!r}")
    return AccessTokenClaims.model_validate(payload)
