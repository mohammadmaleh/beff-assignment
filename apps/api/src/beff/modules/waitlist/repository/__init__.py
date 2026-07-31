"""Data access for the waitlist."""

from beff.modules.waitlist.repository.fakes import InMemoryWaitlistRepository
from beff.modules.waitlist.repository.postgres import PostgresWaitlistRepository
from beff.modules.waitlist.repository.protocols import WaitlistRepository

__all__ = [
    "InMemoryWaitlistRepository",
    "PostgresWaitlistRepository",
    "WaitlistRepository",
]
