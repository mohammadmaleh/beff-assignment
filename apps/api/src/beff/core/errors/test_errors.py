"""Unit tests for the error taxonomy."""

from __future__ import annotations

import pytest

from beff.core.errors import (
    AppError,
    AuthenticationError,
    ConflictError,
    DomainValidationError,
    NotFoundError,
    PermissionDeniedError,
)

CATEGORIES = (
    AuthenticationError,
    PermissionDeniedError,
    NotFoundError,
    ConflictError,
    DomainValidationError,
)


def test_detail_is_carried_as_the_exception_message() -> None:
    error = AppError("something specific went wrong")

    assert error.detail == "something specific went wrong"
    assert str(error) == "something specific went wrong"


def test_every_category_declares_a_distinct_stable_code() -> None:
    """The code, not the prose, is what the frontend translates on."""
    codes = [category.code for category in CATEGORIES]

    assert len(set(codes)) == len(codes)
    assert all(code and code.islower() for code in codes)


def test_a_subclass_may_pin_its_own_code() -> None:
    class EmailTakenError(ConflictError):
        code = "auth.email_already_registered"
        title = "Email already registered"

    error = EmailTakenError("that address is already in use")

    assert error.code == "auth.email_already_registered"
    assert isinstance(error, ConflictError)


def test_code_and_title_can_be_overridden_per_instance() -> None:
    error = NotFoundError("no such plant", code="plants.not_found", title="Plant not found")

    assert error.code == "plants.not_found"
    assert error.title == "Plant not found"


def test_extra_defaults_to_an_empty_mapping() -> None:
    assert AppError("boom").extra == {}


def test_extra_carries_machine_readable_context() -> None:
    error = DomainValidationError("step out of order", extra={"expected_step": "plant"})

    assert error.extra == {"expected_step": "plant"}


def test_every_category_is_catchable_as_app_error() -> None:
    for category in CATEGORIES:
        with pytest.raises(AppError):
            raise category("boom")
