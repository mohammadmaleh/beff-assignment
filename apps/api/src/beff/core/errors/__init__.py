"""The application's error taxonomy.

Deliberately free of HTTP: a service raises `InvalidCredentials`, not a 401. The
mapping from category to status code lives in one place at the edge
(`beff.core.problems`), which is what lets a service be unit-tested without a
request and reused from a worker or a CLI without pretending to be a web
request.
"""

from beff.core.errors.errors import (
    AppError,
    AuthenticationError,
    ConflictError,
    DomainValidationError,
    NotFoundError,
    PermissionDeniedError,
)

__all__ = [
    "AppError",
    "AuthenticationError",
    "ConflictError",
    "DomainValidationError",
    "NotFoundError",
    "PermissionDeniedError",
]
