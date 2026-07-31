"""Wiring: session -> repository -> service -> router."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from beff.db import get_session
from beff.modules.waitlist.repository import PostgresWaitlistRepository
from beff.modules.waitlist.service import WaitlistService

__all__ = ["Service", "get_waitlist_service"]


def get_waitlist_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WaitlistService:
    return WaitlistService(PostgresWaitlistRepository(session))


Service = Annotated[WaitlistService, Depends(get_waitlist_service)]
