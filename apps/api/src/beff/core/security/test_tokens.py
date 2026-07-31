"""Unit tests for access-token minting and refresh-token generation."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest

from beff.core.security import (
    decode_access_token,
    encode_access_token,
    generate_refresh_token,
    hash_refresh_token,
)

# At least 32 bytes: RFC 7518 §3.2 requires a HMAC key no shorter than the hash
# it feeds, and pyjwt warns below that.
SECRET = "unit-test-secret-with-enough-entropy-to-satisfy-rfc-7518"
ALGORITHM = "HS256"


def mint(**overrides: object) -> str:
    """Mint a token that is valid *now* unless a test says otherwise.

    Deliberately not a frozen constant: `exp` is checked against the wall clock
    at decode time, so a hard-coded issue time turns every round-trip test into
    a time bomb that starts failing once the date passes.
    """
    kwargs: dict[str, object] = {
        "subject": uuid4(),
        "role": "member",
        "secret": SECRET,
        "algorithm": ALGORITHM,
        "issued_at": datetime.now(UTC),
        "ttl_seconds": 900,
    }
    kwargs.update(overrides)
    return encode_access_token(**kwargs)  # type: ignore[arg-type]


# ── Refresh tokens ───────────────────────────────────────────────────────────


def test_refresh_tokens_are_unpredictable_and_unique() -> None:
    generated = {generate_refresh_token() for _ in range(500)}

    assert len(generated) == 500


def test_a_refresh_token_carries_at_least_256_bits_of_entropy() -> None:
    """The reason SHA-256 is sufficient to store them: there is nothing to guess."""
    token = generate_refresh_token()

    # url-safe base64: 6 bits per character.
    assert len(token) * 6 >= 256


def test_the_stored_hash_is_64_hex_characters() -> None:
    """The column's CHECK pins this length, so the two must agree."""
    digest = hash_refresh_token(generate_refresh_token())

    assert len(digest) == 64
    assert set(digest) <= set("0123456789abcdef")


def test_hashing_is_deterministic() -> None:
    token = generate_refresh_token()

    assert hash_refresh_token(token) == hash_refresh_token(token)


def test_different_tokens_hash_differently() -> None:
    assert hash_refresh_token("alpha") != hash_refresh_token("beta")


# ── Access tokens ────────────────────────────────────────────────────────────


def test_a_minted_token_round_trips_its_claims() -> None:
    subject = uuid4()

    claims = decode_access_token(
        mint(subject=subject, role="admin"), secret=SECRET, algorithm=ALGORITHM
    )

    assert claims.sub == subject
    assert claims.role == "admin"
    assert claims.typ == "access"


def test_expiry_is_issued_at_plus_the_ttl() -> None:
    claims = decode_access_token(mint(ttl_seconds=900), secret=SECRET, algorithm=ALGORITHM)

    assert claims.exp - claims.iat == timedelta(seconds=900)


def test_each_token_carries_a_unique_id() -> None:
    first = decode_access_token(mint(), secret=SECRET, algorithm=ALGORITHM)
    second = decode_access_token(mint(), secret=SECRET, algorithm=ALGORITHM)

    assert first.jti != second.jti


def test_an_expired_token_is_rejected() -> None:
    stale = mint(issued_at=datetime.now(UTC) - timedelta(hours=2), ttl_seconds=900)

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(stale, secret=SECRET, algorithm=ALGORITHM)


def test_a_token_signed_with_another_secret_is_rejected() -> None:
    with pytest.raises(jwt.InvalidSignatureError):
        decode_access_token(
            mint(secret="a-different-secret-of-a-respectable-length"),
            secret=SECRET,
            algorithm=ALGORITHM,
        )


def test_an_unsigned_token_is_rejected() -> None:
    """`alg: none` is the oldest JWT attack there is.

    Passing an allow-list of exactly one algorithm to `decode` is what closes
    it — the decoder never consults the token's own header for what to trust.
    """
    forged = jwt.encode(
        {
            "sub": str(uuid4()),
            "role": "admin",
            "typ": "access",
            "jti": str(uuid4()),
            "iat": int(datetime.now(UTC).timestamp()),
            "exp": int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
        },
        key="",
        algorithm="none",
    )

    with pytest.raises(jwt.PyJWTError):
        decode_access_token(forged, secret=SECRET, algorithm=ALGORITHM)


def test_a_token_of_the_wrong_type_is_rejected() -> None:
    """Guards against a future token kind being replayed as an access token."""
    mislabelled = jwt.encode(
        {
            "sub": str(uuid4()),
            "role": "member",
            "typ": "password_reset",
            "jti": str(uuid4()),
            "iat": int(datetime.now(UTC).timestamp()),
            "exp": int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
        },
        SECRET,
        algorithm=ALGORITHM,
    )

    with pytest.raises(jwt.InvalidTokenError, match="typ"):
        decode_access_token(mislabelled, secret=SECRET, algorithm=ALGORITHM)


def test_a_token_missing_a_required_claim_is_rejected() -> None:
    incomplete = jwt.encode({"sub": str(uuid4()), "typ": "access"}, SECRET, algorithm=ALGORITHM)

    with pytest.raises(jwt.MissingRequiredClaimError):
        decode_access_token(incomplete, secret=SECRET, algorithm=ALGORITHM)


def test_garbage_is_rejected() -> None:
    with pytest.raises(jwt.PyJWTError):
        decode_access_token("not.a.token", secret=SECRET, algorithm=ALGORITHM)
