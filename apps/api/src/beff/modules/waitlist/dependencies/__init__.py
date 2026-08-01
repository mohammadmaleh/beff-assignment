"""Waitlist wiring."""

from beff.modules.waitlist.dependencies.providers import (
    WAITLIST_LIMIT,
    Service,
    WaitlistRateLimit,
    get_waitlist_service,
    waitlist_rate_limit,
)

__all__ = [
    "WAITLIST_LIMIT",
    "Service",
    "WaitlistRateLimit",
    "get_waitlist_service",
    "waitlist_rate_limit",
]
