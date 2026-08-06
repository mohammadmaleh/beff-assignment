"""Exception handlers that render every failure as a problem document.

Installed on the app in `main.py`. Four handlers cover every way a request can
fail:

1. `AppError`        - an expected domain outcome, with its own code and status.
2. `RequestValidationError` - a malformed request body, query or path, rendered
   with the per-field breakdown the frontend needs for inline errors.
3. `HTTPException`   - raised by FastAPI itself (404 on an unknown route, 405 on
   a wrong method) and by any third-party dependency.
4. `Exception`       - anything left. A bug, rendered without detail.
"""

from __future__ import annotations

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from beff.core.config import Settings
from beff.core.errors import AppError
from beff.core.problems.problem import (
    FieldProblem,
    Problem,
    problem_response,
    status_for,
    type_uri_for,
)

__all__ = ["install_problem_handlers"]

_log = structlog.get_logger(__name__)

# Codes for problems that do not originate from an `AppError`.
HTTP_STATUS_CODES: dict[int, str] = {
    status.HTTP_400_BAD_REQUEST: "bad_request",
    status.HTTP_401_UNAUTHORIZED: "unauthenticated",
    status.HTTP_403_FORBIDDEN: "permission_denied",
    status.HTTP_404_NOT_FOUND: "not_found",
    status.HTTP_405_METHOD_NOT_ALLOWED: "method_not_allowed",
    status.HTTP_409_CONFLICT: "conflict",
    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: "unsupported_media_type",
    status.HTTP_422_UNPROCESSABLE_CONTENT: "validation_error",
    status.HTTP_429_TOO_MANY_REQUESTS: "rate_limited",
}

VALIDATION_CODE = "validation_error"
INTERNAL_CODE = "internal_error"


def _pointer_and_field(location: tuple[int | str, ...]) -> tuple[str, str]:
    """Turn a Pydantic error location into a JSON Pointer and a dotted path.

    Pydantic reports `("body", "email")` or `("body", "lines", 0, "name")`. The
    leading segment names *where* the value came from - body, query, path - and
    is dropped from the pointer, because a pointer is relative to the document
    it points into and the client already knows which document it sent.
    """
    segments = list(location)
    if segments and segments[0] in {"body", "query", "path", "header", "cookie"}:
        segments = segments[1:]

    if not segments:
        # A whole-body failure, e.g. malformed JSON. RFC 6901 spells the
        # document root as the empty string.
        return "", "body"

    pointer = "".join(
        f"/{str(segment).replace('~', '~0').replace('/', '~1')}" for segment in segments
    )
    field = ".".join(str(segment) for segment in segments)
    return pointer, field


def _field_problems(exc: RequestValidationError) -> list[FieldProblem]:
    return [
        FieldProblem(
            pointer=pointer,
            field=field,
            # Pydantic's own machine code - `missing`, `string_too_short`,
            # `value_error`. Stable across releases and already granular enough
            # to translate against.
            code=str(error.get("type", "invalid")),
            detail=str(error.get("msg", "Invalid value.")),
        )
        for error in exc.errors()
        for pointer, field in [_pointer_and_field(tuple(error.get("loc", ())))]
    ]


def install_problem_handlers(app: FastAPI, settings: Settings) -> None:
    """Register the four handlers on `app`."""
    base_uri = settings.problem_base_uri
    # Stack traces belong in the response only where a human is debugging.
    expose_internals = settings.environment != "production"

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return problem_response(
            Problem(
                type=type_uri_for(exc.code, base_uri=base_uri),
                title=exc.title,
                status=status_for(exc),
                detail=exc.detail,
                instance=request.url.path,
                code=exc.code,
                extra=exc.extra or None,
            )
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """422 with a per-field breakdown.

        FastAPI's default renders `{"detail": [...]}` with a shape of its own
        invention. Replacing it is most of the point of ENG-29: one error
        envelope for the whole API means the frontend has one error renderer.
        """
        errors = _field_problems(exc)
        return problem_response(
            Problem(
                type=type_uri_for(VALIDATION_CODE, base_uri=base_uri),
                title="Validation failed",
                status=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=(
                    f"The request body failed validation on {len(errors)} field(s)."
                    if errors
                    else "The request could not be validated."
                ),
                instance=request.url.path,
                code=VALIDATION_CODE,
                errors=errors,
            )
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        """Covers FastAPI's own 404s and 405s, and any library-raised HTTPException."""
        code = HTTP_STATUS_CODES.get(exc.status_code, f"http_{exc.status_code}")
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed."
        response = problem_response(
            Problem(
                type=type_uri_for(code, base_uri=base_uri),
                title=detail if exc.status_code < 500 else "Server error",
                status=exc.status_code,
                detail=detail,
                instance=request.url.path,
                code=code,
            )
        )
        # A 401 without WWW-Authenticate is a protocol violation, and FastAPI
        # puts the header on the exception rather than the response.
        for header, value in (getattr(exc, "headers", None) or {}).items():
            response.headers[header] = value
        return response

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        """Anything unplanned.

        The detail is generic on purpose: an exception message can carry a
        connection string, a SQL fragment or a user's data, and none of that
        belongs in a response. The real error goes to the log, with the
        traceback, where it is correlated by request path.
        """
        _log.exception(
            "unhandled_exception",
            path=request.url.path,
            method=request.method,
            exc_type=type(exc).__name__,
        )
        return problem_response(
            Problem(
                type=type_uri_for(INTERNAL_CODE, base_uri=base_uri),
                title="Server error",
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    f"{type(exc).__name__}: {exc}"
                    if expose_internals
                    else "The server encountered an unexpected condition."
                ),
                instance=request.url.path,
                code=INTERNAL_CODE,
            )
        )

    # Referenced so linters do not flag the closures as unused; the decorators
    # already registered them.
    _ = (
        handle_app_error,
        handle_validation_error,
        handle_http_exception,
        handle_unexpected_error,
    )
