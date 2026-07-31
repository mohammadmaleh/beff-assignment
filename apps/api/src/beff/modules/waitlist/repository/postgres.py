"""PostgreSQL implementation of the waitlist repository."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from beff.modules.waitlist.models import WaitlistEntry

__all__ = ["PostgresWaitlistRepository"]


class PostgresWaitlistRepository:
    """Satisfies `WaitlistRepository` structurally."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_email(self, email: str) -> WaitlistEntry | None:
        result = await self._session.execute(
            select(WaitlistEntry).where(WaitlistEntry.email == email)
        )
        return result.scalar_one_or_none()

    async def add(self, entry: WaitlistEntry) -> WaitlistEntry:
        self._session.add(entry)
        await self._session.flush()
        return entry
