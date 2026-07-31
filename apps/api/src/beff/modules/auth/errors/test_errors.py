"""Unit tests for the auth error codes."""

from __future__ import annotations

from typing import Protocol

from beff.core.errors import AppError, AuthenticationError, ConflictError
from beff.modules.auth.errors import (
    AccessTokenInvalidError,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    RefreshTokenExpiredError,
    RefreshTokenInvalidError,
    RefreshTokenMissingError,
    RefreshTokenReusedError,
)


# `type[AppError]` would be a lie in one direction and `Callable[[], AppError]`
# in the other: the tests read `.code` off the class *and* construct it with no
# arguments, and the base class requires a `detail` it does not have a default
# for. The protocol says both, which is exactly what every subclass provides —
# and that every subclass provides it is the property under test.
class DefaultedError(Protocol):
    """An `AppError` subclass with a code and a usable default message."""

    code: str

    def __call__(self) -> AppError: ...


ALL_AUTH_ERRORS: tuple[DefaultedError, ...] = (
    AccessTokenInvalidError,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    RefreshTokenExpiredError,
    RefreshTokenInvalidError,
    RefreshTokenMissingError,
    RefreshTokenReusedError,
)


def test_every_code_is_namespaced_and_unique() -> None:
    """Codes are the translation key. A collision silently mistranslates."""
    codes = [error.code for error in ALL_AUTH_ERRORS]

    assert len(set(codes)) == len(codes)
    assert all(code.startswith("auth.") for code in codes)


def test_every_error_has_a_usable_default_message() -> None:
    for error in ALL_AUTH_ERRORS:
        assert error().detail


def test_invalid_credentials_does_not_reveal_which_half_was_wrong() -> None:
    """Saying "no such user" is a free account-enumeration oracle."""
    detail = InvalidCredentialsError().detail.lower()

    assert "email or password" in detail
    for leak in ("no such", "not found", "unknown user", "wrong password"):
        assert leak not in detail


def test_categories_map_to_the_right_http_family() -> None:
    assert issubclass(InvalidCredentialsError, AuthenticationError)
    assert issubclass(RefreshTokenReusedError, AuthenticationError)
    assert issubclass(EmailAlreadyRegisteredError, ConflictError)


def test_reuse_is_distinguishable_from_an_ordinary_invalid_token() -> None:
    """The client must be told to sign in again rather than retry the refresh."""
    assert RefreshTokenReusedError.code != RefreshTokenInvalidError.code
    assert "sign in again" in RefreshTokenReusedError().detail.lower()
