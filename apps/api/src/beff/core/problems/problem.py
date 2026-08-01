"""The problem document itself, and the category-to-status mapping.

Keeping the mapping here — rather than on the exception classes — is what lets a
service raise `ConflictError` without importing anything HTTP-shaped. The edge
decides that a conflict is a 409; the domain only says that it is a conflict.
"""

from __future__ import annotations

from typing import Any

from fastapi import status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from beff.core.errors import (
    AppError,
    AuthenticationError,
    ConflictError,
    DomainValidationError,
    NotFoundError,
    PermissionDeniedError,
)
from beff.core.ratelimit.errors import RateLimitExceededError

__all__ = [
    "PROBLEM_CONTENT_TYPE",
    "FieldProblem",
    "Problem",
    "problem_response",
    "status_for",
    "type_uri_for",
]

# RFC 9457 §3. Not `application/json`: a client — or a proxy, or a browser
# devtools pane — can tell a problem document from a successful payload by the
# media type alone.
PROBLEM_CONTENT_TYPE = "application/problem+json"

# Ordered most specific first. `AppError` itself is the fallback.
_STATUS_BY_CATEGORY: tuple[tuple[type[AppError], int], ...] = (
    (AuthenticationError, status.HTTP_401_UNAUTHORIZED),
    (PermissionDeniedError, status.HTTP_403_FORBIDDEN),
    (NotFoundError, status.HTTP_404_NOT_FOUND),
    (ConflictError, status.HTTP_409_CONFLICT),
    (DomainValidationError, status.HTTP_422_UNPROCESSABLE_CONTENT),
    # 429, not 422. The request was well-formed and would have succeeded a
    # minute ago; calling it "invalid" sends the caller looking for a mistake in
    # a payload that does not have one.
    (RateLimitExceededError, status.HTTP_429_TOO_MANY_REQUESTS),
)


def status_for(error: AppError) -> int:
    """The HTTP status for a domain error's category.

    Anything not in the table is a 500 — an `AppError` subclass that forgot to
    pick a category is a programming mistake, not a client error.
    """
    for category, code in _STATUS_BY_CATEGORY:
        if isinstance(error, category):
            return code
    return status.HTTP_500_INTERNAL_SERVER_ERROR


def type_uri_for(code: str, *, base_uri: str) -> str:
    """Build the `type` URI for a problem code.

    RFC 9457 wants a URI that, when dereferenced, documents the problem type.
    Deriving it from the code keeps the two from drifting apart, and means
    adding an error type does not mean remembering to register a URI.
    """
    return f"{base_uri.rstrip('/')}/{code.replace('.', '/')}"


class FieldProblem(BaseModel):
    """One field's worth of a validation failure.

    This is what makes server-side validation renderable inline. Without the
    pointer the frontend can only show a banner; with it, the message lands on
    the input that caused it.
    """

    model_config = ConfigDict(frozen=True)

    pointer: str = Field(
        description=(
            "RFC 6901 JSON Pointer into the request body, e.g. `/email` or `/lines/0/cell_format`."
        ),
        examples=["/email"],
    )
    field: str = Field(
        description="Dotted path, for clients that key their form state by name.",
        examples=["email"],
    )
    code: str = Field(
        description="Stable, translatable reason. Never parse `detail` instead.",
        examples=["value_error"],
    )
    detail: str = Field(description="English explanation. For logs and developers.")


class Problem(BaseModel):
    """An RFC 9457 problem document.

    The five members `type`, `title`, `status`, `detail` and `instance` are the
    RFC's; `code` and `errors` are extension members, which §3.2 explicitly
    allows.
    """

    model_config = ConfigDict(frozen=True)

    type: str = Field(description="URI identifying the problem type.")
    title: str = Field(description="Short, human-readable summary. Stable per type.")
    status: int = Field(description="HTTP status code, repeated for clients that lost it.")
    detail: str = Field(description="Explanation specific to this occurrence.")
    instance: str = Field(description="URI of the specific occurrence — the request path.")

    code: str = Field(
        description=(
            "Stable machine-readable identifier. The frontend switches on this to "
            "pick an EN or DE message; it never parses `title` or `detail`."
        ),
        examples=["auth.invalid_credentials"],
    )
    errors: list[FieldProblem] | None = Field(
        default=None,
        description="Per-field breakdown. Present on validation failures only.",
    )
    extra: dict[str, Any] | None = Field(
        default=None,
        description="Additional machine-readable context, when a type defines any.",
    )


def problem_response(problem: Problem) -> JSONResponse:
    """Render a problem document with the correct media type.

    `exclude_none` so a non-validation problem does not carry a null `errors`
    key — RFC 9457 members are optional by absence, not by null.
    """
    return JSONResponse(
        status_code=problem.status,
        content=problem.model_dump(mode="json", exclude_none=True),
        media_type=PROBLEM_CONTENT_TYPE,
    )
