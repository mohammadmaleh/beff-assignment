"""Unit tests for the auth request and response schemas."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from beff.modules.auth.schemas import (
    LoginRequest,
    RegisterRequest,
    SessionResponse,
    UserResponse,
)


def test_registration_accepts_a_well_formed_payload() -> None:
    request = RegisterRequest(
        email="ada@beff.example",
        password="a-long-enough-passphrase",
        display_name="Ada Lovelace",
    )

    assert request.email == "ada@beff.example"


def test_email_is_lower_cased_so_case_cannot_split_an_account() -> None:
    request = RegisterRequest(
        email="Ada.Lovelace@Beff.Example",
        password="a-long-enough-passphrase",
        display_name="Ada",
    )

    assert request.email == "ada.lovelace@beff.example"


def test_a_malformed_email_is_rejected() -> None:
    with pytest.raises(ValidationError, match="email"):
        RegisterRequest(
            email="not-an-email", password="a-long-enough-passphrase", display_name="Ada"
        )


def test_a_short_password_is_rejected() -> None:
    """NIST SP 800-63B: length is the control, so it is the one enforced."""
    with pytest.raises(ValidationError, match="at least 12"):
        RegisterRequest(email="ada@beff.example", password="short", display_name="Ada")


def test_a_pathologically_long_password_is_rejected() -> None:
    """Argon2 cost scales with input; an unbounded field is a DoS vector."""
    with pytest.raises(ValidationError):
        RegisterRequest(email="ada@beff.example", password="x" * 5000, display_name="Ada")


def test_a_password_with_no_symbols_is_accepted() -> None:
    """Composition rules push users towards weaker passwords, so there are none."""
    request = RegisterRequest(
        email="ada@beff.example",
        password="correct horse battery staple",
        display_name="Ada",
    )

    assert request.password == "correct horse battery staple"


def test_a_blank_display_name_is_rejected() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="ada@beff.example", password="a-long-enough-passphrase", display_name="   "
        )


def test_unknown_fields_are_rejected_rather_than_ignored() -> None:
    """A typo'd field name silently doing nothing is worse than an error."""
    with pytest.raises(ValidationError, match="role"):
        RegisterRequest(
            email="ada@beff.example",
            password="a-long-enough-passphrase",
            display_name="Ada",
            role="admin",  # type: ignore[call-arg]
        )


def test_login_does_not_impose_a_password_length_floor() -> None:
    """It would lock out accounts made under an older policy, and leak the
    stored password's length class."""
    request = LoginRequest(email="ada@beff.example", password="old")

    assert request.password == "old"


def test_a_user_response_omits_the_password_hash() -> None:
    payload = UserResponse(
        id=uuid4(),
        email="ada@beff.example",
        display_name="Ada",
        role="member",
        created_at=datetime.now(UTC),
    ).model_dump()

    assert "password_hash" not in payload
    assert "deleted_at" not in payload


def test_a_session_response_never_carries_the_refresh_token() -> None:
    """It is httpOnly-cookie-only by design (ADR-0003). A body field would put
    it back within reach of injected JavaScript."""
    fields = set(SessionResponse.model_fields)

    assert "refresh_token" not in fields
    assert fields == {"access_token", "token_type", "expires_in", "user"}
