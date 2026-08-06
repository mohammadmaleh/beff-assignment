"""Async engine, session factory and the FastAPI session dependency."""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from beff.core.config import get_settings

__all__ = [
    "create_session_factory",
    "dispose_engine",
    "get_engine",
    "get_session",
    "get_session_factory",
]

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """The process-wide engine, created on first use.

    Lazy rather than module-level so importing `beff.db` does not require a
    reachable database - unit tests import models constantly and never connect.
    """
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=5,
        )
    return _engine


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Build a session factory bound to `engine`.

    `expire_on_commit=False` because an async attribute refresh after commit
    would emit lazy IO from a response serialiser, which raises rather than
    silently blocking.
    """
    return async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """The process-wide session factory, created on first use."""
    global _session_factory
    if _session_factory is None:
        _session_factory = create_session_factory(get_engine())
    return _session_factory


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding a session with request-scoped transaction.

    Commits when the handler returns, rolls back if it raises. Handlers and
    services therefore never call `commit()` themselves - the unit of work is
    the request.
    """
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        else:
            await session.commit()


async def dispose_engine() -> None:
    """Close pooled connections. Called from the app's lifespan shutdown."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None
