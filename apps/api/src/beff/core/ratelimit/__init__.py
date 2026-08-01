"""Rate limiting, without Redis.

A fixed-window counter in a Postgres table. Not because it is the best possible
limiter — a sliding window in Redis is — but because the alternative here is
*no* limiter, and adding a second datastore to get one is the trade ADR-0006
already refused.
"""

from beff.core.ratelimit.dependencies import get_limiter_session
from beff.core.ratelimit.errors import RateLimitExceededError
from beff.core.ratelimit.limiter import RateLimit, RateLimiter
from beff.core.ratelimit.model import RateLimitCounter

__all__ = [
    "RateLimit",
    "RateLimitCounter",
    "RateLimitExceededError",
    "RateLimiter",
    "get_limiter_session",
]
