"""A session for the limiter, independent of the request's.

## Why this exists

`get_session` gives the request one transaction and rolls it back if the handler
raises. That is right for business data - a failed registration should not leave
half a user behind - and **wrong for a rate limiter**, because the attempts a
limiter most needs to count are exactly the ones that raise.

Sharing the request's session meant every failed login rolled back its own
increment, so an attacker making nothing but wrong-password attempts was never
limited. The limiter counted only the requests that did not need limiting.

So the counter gets its own connection and commits immediately. The cost is one
extra connection per limited request; the alternative is a limiter that does not
limit.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from beff.db import get_session_factory

__all__ = ["get_limiter_session"]


async def get_limiter_session() -> AsyncIterator[AsyncSession]:
    """A short-lived session that commits on the way out, always.

    No `except: rollback` branch, deliberately. If the increment itself fails the
    transaction is discarded when the context manager closes, and there is
    nothing else in it to protect.
    """
    factory = get_session_factory()
    async with factory() as session:
        yield session
        await session.commit()
