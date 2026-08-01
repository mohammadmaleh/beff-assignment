"""Structured logging with a request id on every line.

`structlog` was a dependency with no strategy behind it. A log line that cannot
be tied to the request that produced it is nearly useless during an incident:
you can see that something failed, but not what the user was doing, and not
which of the twelve concurrent requests it belonged to.
"""

from beff.core.observability.context import bind_request_id, get_request_id
from beff.core.observability.logging import configure_logging
from beff.core.observability.middleware import REQUEST_ID_HEADER, RequestIdMiddleware

__all__ = [
    "REQUEST_ID_HEADER",
    "RequestIdMiddleware",
    "bind_request_id",
    "configure_logging",
    "get_request_id",
]
