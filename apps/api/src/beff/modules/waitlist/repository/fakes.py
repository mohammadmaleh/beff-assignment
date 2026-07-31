"""In-memory waitlist repository."""

from __future__ import annotations

from itertools import count

from beff.db.base import utcnow
from beff.modules.waitlist.models import WaitlistEntry

__all__ = ["InMemoryWaitlistRepository"]


class InMemoryWaitlistRepository:
    """A list that enforces `uq_waitlist_entries_email`."""

    def __init__(self) -> None:
        self.entries: list[WaitlistEntry] = []
        self._ids = count(1)

    async def get_by_email(self, email: str) -> WaitlistEntry | None:
        return next((entry for entry in self.entries if entry.email == email), None)

    async def add(self, entry: WaitlistEntry) -> WaitlistEntry:
        if await self.get_by_email(entry.email) is not None:
            # Mirrors the unique index. A fake that let this through would make
            # the service's duplicate check look tested when it is not.
            raise ValueError(f"duplicate waitlist email: {entry.email}")
        entry.id = next(self._ids)
        now = utcnow()
        if getattr(entry, "created_at", None) is None:
            entry.created_at = now
        if getattr(entry, "updated_at", None) is None:
            entry.updated_at = now
        self.entries.append(entry)
        return entry
