"""The request id, carried without being passed.

A `ContextVar` rather than a parameter threaded through every signature. The id
is ambient context - a repository has no business taking it as an argument, and
a codebase where it does is one where the first person in a hurry drops it.

`ContextVar` is the right primitive for async specifically: each task gets its
own copy, so two concurrent requests cannot see each other's id. A module-level
global would interleave them silently, which is worse than no id at all because
the log would then be confidently wrong.
"""

from __future__ import annotations

from contextvars import ContextVar

__all__ = ["bind_request_id", "get_request_id"]

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def bind_request_id(request_id: str) -> None:
    """Attach an id to the current task."""
    _request_id.set(request_id)


def get_request_id() -> str | None:
    """The current task's id, or `None` outside a request.

    `None` rather than a placeholder: a background job genuinely has no request
    id, and inventing one would make the log claim a correlation that does not
    exist.
    """
    return _request_id.get()
