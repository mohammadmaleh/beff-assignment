"""Assign a request id, and hand it back to the caller."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from beff.core.ids import uuid7
from beff.core.observability.context import bind_request_id

__all__ = ["REQUEST_ID_HEADER", "RequestIdMiddleware"]

REQUEST_ID_HEADER = "X-Request-ID"

log = structlog.get_logger(__name__)


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Give every request an id, log its outcome, and echo the id back.

    The id is **accepted from the caller** when they send one, so a trace that
    started at a load balancer or in the frontend stays one trace rather than
    becoming two halves nobody can join. It is generated when they do not.

    Echoing it in the response header is what makes it usable by a human: a user
    reporting "it failed at about two o'clock" is hard to find in a log; a user
    quoting an id is one query.
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # UUIDv7 rather than uuid4: it sorts by creation time, so a log sorted by
        # request id is also sorted chronologically.
        incoming = request.headers.get(REQUEST_ID_HEADER)
        request_id = incoming if incoming else str(uuid7())
        bind_request_id(request_id)

        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id

        # One line per request, at the end, with the outcome. Logging on the way
        # in as well would double the volume to say something the completion
        # line already says — except for requests that never complete, and those
        # are visible as a missing line against an id the client still has.
        log.info(
            "http.request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
        )
        return response
