"""The failure a limiter produces."""

from __future__ import annotations

from beff.core.errors import AppError

__all__ = ["RateLimitExceededError"]


class RateLimitExceededError(AppError):
    """Too many requests in the window.

    Its own class rather than a `DomainValidationError`, because 429 is not 422:
    the request was well-formed and would have succeeded a minute ago. Telling a
    client "invalid" for something that is only *early* sends them looking for a
    mistake in their payload.
    """

    code = "rate_limit_exceeded"
    title = "Too many requests"

    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__(
            "Too many requests. Please try again shortly.",
            extra={"retry_after_seconds": retry_after_seconds},
        )
        self.retry_after_seconds = retry_after_seconds
