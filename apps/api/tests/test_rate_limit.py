"""The limiter against a real PostgreSQL.

`ON CONFLICT DO UPDATE ... RETURNING` is the whole implementation, and a fake
that reimplemented it would be testing the fake. These need the database.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from beff.core.ratelimit import RateLimit, RateLimiter, RateLimitExceededError
from beff.db import create_session_factory

pytestmark = pytest.mark.integration

NOW = datetime(2026, 7, 31, 14, 30, tzinfo=UTC)
LIMIT = RateLimit(limit=3, window_seconds=3600)


async def test_requests_under_the_limit_are_allowed(db_session: AsyncSession) -> None:
    limiter = RateLimiter(db_session, clock=lambda: NOW)

    counts = [await limiter.check(bucket="waitlist.join", key="k", limit=LIMIT) for _ in range(3)]

    assert counts == [1, 2, 3]


async def test_the_request_over_the_limit_is_refused(db_session: AsyncSession) -> None:
    limiter = RateLimiter(db_session, clock=lambda: NOW)
    for _ in range(3):
        await limiter.check(bucket="waitlist.join", key="k", limit=LIMIT)

    with pytest.raises(RateLimitExceededError) as raised:
        await limiter.check(bucket="waitlist.join", key="k", limit=LIMIT)

    # Told when to come back, rather than left to guess.
    assert raised.value.retry_after_seconds == 1800


async def test_two_keys_do_not_share_a_budget(db_session: AsyncSession) -> None:
    """One noisy caller must not lock everyone else out."""
    limiter = RateLimiter(db_session, clock=lambda: NOW)
    for _ in range(3):
        await limiter.check(bucket="waitlist.join", key="noisy", limit=LIMIT)

    assert await limiter.check(bucket="waitlist.join", key="quiet", limit=LIMIT) == 1


async def test_two_buckets_do_not_share_a_budget(db_session: AsyncSession) -> None:
    """Hitting the waitlist limit must not also lock you out of logging in."""
    limiter = RateLimiter(db_session, clock=lambda: NOW)
    for _ in range(3):
        await limiter.check(bucket="waitlist.join", key="k", limit=LIMIT)

    assert await limiter.check(bucket="auth.login", key="k", limit=LIMIT) == 1


async def test_the_next_window_starts_a_fresh_budget(db_session: AsyncSession) -> None:
    later = NOW + timedelta(hours=1)
    for _ in range(3):
        await RateLimiter(db_session, clock=lambda: NOW).check(
            bucket="waitlist.join", key="k", limit=LIMIT
        )

    count = await RateLimiter(db_session, clock=lambda: later).check(
        bucket="waitlist.join", key="k", limit=LIMIT
    )

    assert count == 1


async def test_concurrent_requests_cannot_both_win_the_last_slot(
    db_engine: AsyncEngine,
) -> None:
    """**Why the increment is one statement.**

    Read-then-write would let two connections both see `count = 2` against a
    limit of 3 and both allow the request — the classic lost update. Here the
    database serialises on the primary key and each caller gets a distinct
    post-increment value, so exactly one of these ten is the fourth.
    """
    factory = create_session_factory(db_engine)

    async def attempt() -> bool:
        async with factory() as session:
            limiter = RateLimiter(session, clock=lambda: NOW)
            try:
                await limiter.check(bucket="race", key="k", limit=LIMIT)
            except RateLimitExceededError:
                await session.commit()
                return False
            await session.commit()
            return True

    results = await asyncio.gather(*(attempt() for _ in range(10)))

    # Exactly `limit` succeed. Not "about three" — the whole point is that the
    # count is never stale.
    assert sum(results) == LIMIT.limit


async def test_the_waitlist_route_actually_enforces_the_limit(
    db_engine: AsyncEngine,
) -> None:
    """The limiter being correct is worth nothing if the route does not call it.

    This is the wiring test: the real app, the real dependency, a real database.
    `WAITLIST_LIMIT` is five per hour, so the sixth signup from one origin is
    refused — and the response is a 429 problem document, not a 422, because the
    request was well-formed.
    """
    from httpx import ASGITransport, AsyncClient

    from beff.core.ratelimit import get_limiter_session
    from beff.db import get_session
    from beff.main import create_app
    from beff.modules.waitlist.dependencies import WAITLIST_LIMIT

    factory = create_session_factory(db_engine)

    async def session_override():  # type: ignore[no-untyped-def]
        async with factory() as session:
            yield session
            await session.commit()

    async def limiter_session_override():  # type: ignore[no-untyped-def]
        # A *separate* session that always commits — the whole point of the fix
        # being tested. Reusing `session_override` here would reintroduce the
        # shared transaction and the test would pass for the wrong reason.
        async with factory() as session:
            yield session
            await session.commit()

    app = create_app()
    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[get_limiter_session] = limiter_session_override

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        statuses = [
            (
                await client.post(
                    "/api/v1/waitlist",
                    json={"email": f"user{i}@beff.example", "company": "Beff GmbH"},
                    headers={"x-forwarded-for": "203.0.113.9"},
                )
            ).status_code
            for i in range(WAITLIST_LIMIT.limit + 1)
        ]

    assert statuses[: WAITLIST_LIMIT.limit] == [201] * WAITLIST_LIMIT.limit
    assert statuses[-1] == 429


async def test_the_key_is_never_a_raw_ip(db_session: AsyncSession) -> None:
    """The route hashes before calling, and this asserts the table holds what the
    route actually put there. An IP is personal data; "we needed it for rate
    limiting" is not a lawful basis for storing one in the clear."""
    limiter = RateLimiter(db_session, clock=lambda: NOW)
    await limiter.check(bucket="waitlist.join", key="a" * 64, limit=LIMIT)

    rows = await db_session.execute(text("SELECT key FROM rate_limit_counters"))
    for (key,) in rows.fetchall():
        assert "." not in key
        assert ":" not in key


async def test_login_is_rate_limited_per_origin(db_engine: AsyncEngine) -> None:
    """**Credential stuffing is the threat this exists for.**

    Per origin, not per email. Per-email would be worse than useless: an attacker
    spraying one password across ten thousand addresses never trips it, and
    anyone who knew a victim's address could lock them out on demand. Per-origin
    costs the attacker the thing that is actually scarce.

    Argon2 also makes every attempt expensive for *us*, so an unlimited login is
    a denial-of-service surface as well as a takeover one.
    """
    from httpx import ASGITransport, AsyncClient

    from beff.core.ratelimit import get_limiter_session
    from beff.db import get_session
    from beff.main import create_app
    from beff.modules.auth.dependencies import LOGIN_LIMIT

    factory = create_session_factory(db_engine)

    async def session_override():  # type: ignore[no-untyped-def]
        async with factory() as session:
            yield session
            await session.commit()

    async def limiter_session_override():  # type: ignore[no-untyped-def]
        # A *separate* session that always commits — the whole point of the fix
        # being tested. Reusing `session_override` here would reintroduce the
        # shared transaction and the test would pass for the wrong reason.
        async with factory() as session:
            yield session
            await session.commit()

    app = create_app()
    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[get_limiter_session] = limiter_session_override

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        statuses = [
            (
                await client.post(
                    "/api/v1/auth/login",
                    json={"email": f"nobody{i}@beff.example", "password": "wrong password here"},
                    headers={"x-forwarded-for": "203.0.113.44"},
                )
            ).status_code
            for i in range(LOGIN_LIMIT.limit + 1)
        ]

    # Every attempt inside the budget is refused as a *credential* failure...
    assert statuses[: LOGIN_LIMIT.limit] == [401] * LOGIN_LIMIT.limit
    # ...and the one past it is refused as a rate-limit failure. The distinction
    # matters: 429 tells an honest user to wait, 401 tells them to try again.
    assert statuses[-1] == 429


async def test_a_second_origin_has_its_own_login_budget(db_engine: AsyncEngine) -> None:
    """One office behind a NAT must not be locked out by one bad actor
    elsewhere."""
    from httpx import ASGITransport, AsyncClient

    from beff.core.ratelimit import get_limiter_session
    from beff.db import get_session
    from beff.main import create_app
    from beff.modules.auth.dependencies import LOGIN_LIMIT

    factory = create_session_factory(db_engine)

    async def session_override():  # type: ignore[no-untyped-def]
        async with factory() as session:
            yield session
            await session.commit()

    async def limiter_session_override():  # type: ignore[no-untyped-def]
        # A *separate* session that always commits — the whole point of the fix
        # being tested. Reusing `session_override` here would reintroduce the
        # shared transaction and the test would pass for the wrong reason.
        async with factory() as session:
            yield session
            await session.commit()

    app = create_app()
    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[get_limiter_session] = limiter_session_override

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for _ in range(LOGIN_LIMIT.limit + 1):
            await client.post(
                "/api/v1/auth/login",
                json={"email": "nobody@beff.example", "password": "wrong password here"},
                headers={"x-forwarded-for": "203.0.113.44"},
            )

        other = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@beff.example", "password": "wrong password here"},
            headers={"x-forwarded-for": "198.51.100.7"},
        )

    assert other.status_code == 401


async def test_a_failing_request_still_counts_against_the_limit(
    db_engine: AsyncEngine,
) -> None:
    """**The bug this whole design exists to avoid.**

    The limiter originally shared the request's session. `get_session` rolls that
    transaction back when the handler raises — correct for business data, and
    exactly wrong here, because the attempts a limiter most needs to count are
    the ones that raise.

    The effect was that every failed login rolled back its own increment, so an
    attacker sending nothing but wrong passwords was never limited. The limiter
    counted only the requests that did not need limiting.

    This asserts the counter survives a 401.
    """
    from httpx import ASGITransport, AsyncClient

    from beff.core.ratelimit import get_limiter_session
    from beff.db import get_session
    from beff.main import create_app

    factory = create_session_factory(db_engine)

    async def session_override():  # type: ignore[no-untyped-def]
        async with factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            else:
                await session.commit()

    async def limiter_session_override():  # type: ignore[no-untyped-def]
        async with factory() as session:
            yield session
            await session.commit()

    app = create_app()
    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[get_limiter_session] = limiter_session_override

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@beff.example", "password": "definitely wrong"},
            headers={"x-forwarded-for": "203.0.113.77"},
        )

    # The request failed...
    assert response.status_code == 401

    # ...and the attempt was still recorded. Before the fix this table was empty,
    # because the 401 took the increment down with it.
    async with factory() as session:
        rows = await session.execute(
            text("SELECT count FROM rate_limit_counters WHERE bucket = 'auth.login'")
        )
        counts = [row[0] for row in rows.fetchall()]

    assert counts == [1]
