"""Configure structlog once, at startup."""

from __future__ import annotations

import logging
from collections.abc import MutableMapping
from typing import Any

import structlog

from beff.core.observability.context import get_request_id

__all__ = ["configure_logging"]


def _add_request_id(
    _logger: Any,
    _method: str,
    event: MutableMapping[str, Any],
) -> MutableMapping[str, Any]:
    """Put the current request id on every line that has one.

    A processor rather than something each call site remembers to pass. The
    whole value of a correlation id is that it is on *every* line, and any
    scheme relying on discipline at hundreds of call sites has holes in it
    exactly where the interesting failures are.
    """
    request_id = get_request_id()
    if request_id is not None:
        event["request_id"] = request_id
    return event


def configure_logging(*, json_logs: bool, level: str = "INFO") -> None:
    """Set up structlog and the stdlib root logger together.

    Both, because uvicorn and SQLAlchemy log through the stdlib and their lines
    are the ones you want during an incident. Configuring only structlog gives
    you beautiful application logs and unreadable framework ones interleaved.

    JSON in production because a log aggregator parses it; the console renderer
    in development because a human reads it. The same decision, opposite answers.
    """
    shared: list[structlog.typing.Processor] = [
        structlog.contextvars.merge_contextvars,
        _add_request_id,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        # ISO-8601 in UTC. A log timestamp in local time is a log that cannot be
        # correlated across regions.
        structlog.processors.TimeStamper(fmt="iso", utc=True),
    ]

    renderer: structlog.typing.Processor = (
        structlog.processors.JSONRenderer()
        if json_logs
        else structlog.dev.ConsoleRenderer(colors=True)
    )

    structlog.configure(
        processors=[
            *shared,
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelNamesMapping()[level]),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        level=logging.getLevelNamesMapping()[level],
        force=True,
    )
