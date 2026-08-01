"""Wiring: session -> repository -> service -> router."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from beff.core.config import Settings, get_settings
from beff.core.ratelimit import RateLimit, RateLimiter, get_limiter_session
from beff.core.security import hash_ip
from beff.db import get_session
from beff.modules.waitlist.repository import PostgresWaitlistRepository
from beff.modules.waitlist.service import WaitlistService

__all__ = ["Service", "WaitlistRateLimit", "get_waitlist_service", "waitlist_rate_limit"]

# Five signups per hour from one origin. Generous for a person — nobody signs up
# five times by accident — and low enough that scripted abuse of the app's only
# anonymous write is not worth the effort.
WAITLIST_LIMIT = RateLimit(limit=5, window_seconds=3600)


def get_waitlist_service(
    # The *request* session, not the limiter's. Creating a waitlist entry is
    # business data and belongs in the request's unit of work — if the handler
    # raises afterwards, the row should go with it.
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WaitlistService:
    return WaitlistService(PostgresWaitlistRepository(session))


Service = Annotated[WaitlistService, Depends(get_waitlist_service)]


async def waitlist_rate_limit(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_limiter_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    """Count this request against the caller's hourly budget.

    A dependency rather than middleware, so it applies to exactly this route and
    its cost is visible in the signature of the thing it protects.

    The key is a **salted hash of the IP**, never the address. The same rule that
    governs consent records governs this table: an IP is personal data, and
    "we needed it for rate limiting" is not a lawful basis for storing one in
    the clear.
    """
    forwarded = request.headers.get("x-forwarded-for")
    origin = (
        forwarded.split(",")[0].strip()
        if forwarded
        else (request.client.host if request.client else "unknown")
    )

    await RateLimiter(session).check(
        bucket="waitlist.join",
        key=hash_ip(origin, salt=settings.ip_hash_salt),
        limit=WAITLIST_LIMIT,
    )


WaitlistRateLimit = Depends(waitlist_rate_limit)
