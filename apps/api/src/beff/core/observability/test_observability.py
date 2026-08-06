"""Unit tests for request-id correlation."""

from __future__ import annotations

import asyncio
from uuid import UUID

from httpx import ASGITransport, AsyncClient

from beff.core.observability import (
    REQUEST_ID_HEADER,
    bind_request_id,
    get_request_id,
)
from beff.main import create_app


async def test_there_is_no_request_id_outside_a_request() -> None:
    """`None`, not a placeholder. A background job genuinely has no request id,
    and inventing one would make the log claim a correlation that does not
    exist."""
    assert get_request_id() is None


async def test_concurrent_tasks_do_not_see_each_others_id() -> None:
    """**Why this is a `ContextVar` and not a module global.**

    A global would interleave two in-flight requests silently, and the log would
    then be confidently wrong - worse than having no id at all, because someone
    would trust it during an incident.
    """
    seen: dict[str, str | None] = {}

    async def request(name: str) -> None:
        bind_request_id(name)
        # Yield, so the two tasks genuinely interleave rather than running to
        # completion one after the other.
        await asyncio.sleep(0)
        seen[name] = get_request_id()

    await asyncio.gather(request("first"), request("second"))

    assert seen == {"first": "first", "second": "second"}


async def test_every_response_carries_a_request_id() -> None:
    app = create_app()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/healthz")

    assert response.headers[REQUEST_ID_HEADER]


async def test_a_caller_supplied_id_is_kept() -> None:
    """A trace that started at a load balancer or in the frontend stays one
    trace, rather than becoming two halves nobody can join."""
    app = create_app()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/healthz", headers={REQUEST_ID_HEADER: "from-the-edge"})

    assert response.headers[REQUEST_ID_HEADER] == "from-the-edge"


async def test_two_requests_get_different_ids() -> None:
    app = create_app()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        first = await client.get("/healthz")
        second = await client.get("/healthz")

    assert first.headers[REQUEST_ID_HEADER] != second.headers[REQUEST_ID_HEADER]


async def test_generated_ids_sort_chronologically() -> None:
    """UUIDv7, not uuid4 - so a log sorted by request id is also sorted by time.

    Asserted on the **timestamp prefix**, not on the whole id. `uuid7` documents
    that ordering holds across milliseconds and not within one - inside a single
    millisecond two ids differ only in their random bits - and five in-process
    requests to `/healthz` land in the same millisecond most of the time. The
    stricter assertion was therefore testing `secrets.randbits`, and failed
    roughly one run in six for a generator that was behaving exactly as
    specified.
    """
    app = create_app()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        ids = [(await client.get("/healthz")).headers[REQUEST_ID_HEADER] for _ in range(5)]

    # The leading 48 bits are unix_ts_ms. Non-decreasing is the real guarantee,
    # and it is the one that makes a log sorted by id readable in time order.
    milliseconds = [UUID(value).int >> 80 for value in ids]

    assert milliseconds == sorted(milliseconds)


async def test_an_error_response_still_carries_an_id() -> None:
    """The one case where it matters most: a user quoting an id from a failure
    is one log query, and "it broke around two o'clock" is not."""
    app = create_app()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.headers[REQUEST_ID_HEADER]
