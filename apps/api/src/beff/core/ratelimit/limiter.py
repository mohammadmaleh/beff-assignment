"""A fixed-window counter, kept in Postgres.

## Why a fixed window

A sliding window is more accurate — a fixed window lets a caller send `limit`
requests at 11:59:59 and `limit` again at 12:00:00, so the true worst case is
twice the nominal rate. For an abuse control on a waitlist form that is
acceptable, and it buys an implementation that is a single atomic statement with
no background expiry.

## Why one statement

`INSERT ... ON CONFLICT DO UPDATE ... RETURNING` is what makes this correct
under concurrency. Read-then-write would let two workers both see `count = 4`
against a limit of 5 and both allow the request. Here the database serialises
the increment on the primary key and hands back the post-increment value, so the
decision is made on a number that cannot be stale.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from beff.core.ratelimit.errors import RateLimitExceededError
from beff.db.base import utcnow

__all__ = ["RateLimit", "RateLimiter"]


@dataclass(frozen=True, slots=True)
class RateLimit:
    """How many requests, over how long."""

    limit: int
    window_seconds: int

    def window_start(self, now: datetime) -> datetime:
        """Floor `now` to the window it belongs to.

        Deriving the bucket from the clock rather than storing an expiry means
        there is nothing to sweep: yesterday's rows simply stop being addressed,
        and a periodic `DELETE` reclaims them whenever anyone gets round to it.
        """
        epoch = int(now.timestamp())
        return datetime.fromtimestamp(epoch - (epoch % self.window_seconds), tz=UTC)


class RateLimiter:
    """Counts requests per key per window."""

    def __init__(self, session: AsyncSession, *, clock: Callable[[], datetime] = utcnow) -> None:
        self._session = session
        self._clock = clock

    async def check(self, *, bucket: str, key: str, limit: RateLimit) -> int:
        """Count this request and raise if it puts the key over the limit.

        `bucket` names the thing being limited (`waitlist.join`); `key` is who is
        doing it. Keeping them separate means one caller hitting the waitlist
        limit does not also lock them out of logging in.

        Returns the post-increment count, so a caller can set `X-RateLimit-*`
        headers if it wants to.
        """
        now = self._clock()
        window_start = limit.window_start(now)

        result = await self._session.execute(
            text(
                """
                INSERT INTO rate_limit_counters (bucket, key, window_start, count)
                VALUES (:bucket, :key, :window_start, 1)
                ON CONFLICT (bucket, key, window_start)
                DO UPDATE SET count = rate_limit_counters.count + 1
                RETURNING count
                """
            ),
            {"bucket": bucket, "key": key, "window_start": window_start},
        )
        count = int(result.scalar_one())

        if count > limit.limit:
            # Seconds until this window closes, so the client is told when to
            # come back rather than left to guess.
            elapsed = int((now - window_start).total_seconds())
            raise RateLimitExceededError(max(1, limit.window_seconds - elapsed))

        return count
