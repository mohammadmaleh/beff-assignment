"""Base error classes.

Every error carries a **stable `code`**. That code, not the English prose, is
the contract with the frontend: `auth.invalid_credentials` is what the client
switches on to pick between an EN and a DE message. Prose can be reworded
without breaking a translation; a code cannot be changed without a version bump.
"""

from __future__ import annotations

from typing import Any

__all__ = [
    "AppError",
    "AuthenticationError",
    "ConflictError",
    "DomainValidationError",
    "NotFoundError",
    "PermissionDeniedError",
]


class AppError(Exception):
    """Base class for every expected, client-visible failure.

    "Expected" is the operative word. An `AppError` is a defined outcome of a
    use case - wrong password, email taken - and renders as a specific problem
    type. Anything else escaping a handler is a bug and renders as a generic
    500, deliberately without detail.
    """

    code: str = "internal_error"
    title: str = "Unexpected error"

    def __init__(
        self,
        detail: str,
        *,
        code: str | None = None,
        title: str | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        if code is not None:
            self.code = code
        if title is not None:
            self.title = title
        # Machine-readable context for the client. Never put anything in here
        # that the requester is not already entitled to see.
        self.extra: dict[str, Any] = extra or {}


class AuthenticationError(AppError):
    """Who you are could not be established. Maps to 401."""

    code = "unauthenticated"
    title = "Not authenticated"


class PermissionDeniedError(AppError):
    """Who you are is known and is not allowed to do this. Maps to 403."""

    code = "permission_denied"
    title = "Not permitted"


class NotFoundError(AppError):
    """Maps to 404."""

    code = "not_found"
    title = "Not found"


class ConflictError(AppError):
    """The request contradicts current state. Maps to 409."""

    code = "conflict"
    title = "Conflict"


class DomainValidationError(AppError):
    """Well-formed input that a business rule rejects. Maps to 422.

    Distinct from a Pydantic `RequestValidationError`, which is about shape.
    This one is about meaning - the request parsed fine and is still not
    allowed.
    """

    code = "validation_error"
    title = "Validation failed"
