"""Persistence models for the waitlist module."""

from beff.modules.waitlist.models.entry import (
    COMPANY_MAX_LENGTH,
    EMAIL_MAX_LENGTH,
    WAITLIST_POLICY_VERSION,
    WaitlistEntry,
)

__all__ = [
    "COMPANY_MAX_LENGTH",
    "EMAIL_MAX_LENGTH",
    "WAITLIST_POLICY_VERSION",
    "WaitlistEntry",
]
