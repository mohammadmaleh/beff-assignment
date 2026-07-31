"""What the waitlist service needs from storage."""

from __future__ import annotations

from typing import Protocol

from beff.modules.waitlist.models import WaitlistEntry

__all__ = ["WaitlistRepository"]


class WaitlistRepository(Protocol):
    async def get_by_email(self, email: str) -> WaitlistEntry | None: ...

    async def add(self, entry: WaitlistEntry) -> WaitlistEntry: ...
