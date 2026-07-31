"""Unit tests for engine and session wiring.

No connection is opened: SQLAlchemy builds an engine lazily, so the pool
configuration can be asserted without a database.
"""

from __future__ import annotations

import pytest

from beff.core.config import get_settings
from beff.db import create_session_factory, dispose_engine, get_engine, get_session_factory


@pytest.fixture(autouse=True)
async def _reset_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@localhost:5432/beff_test")
    get_settings.cache_clear()
    await dispose_engine()


async def test_engine_is_created_once_and_reused() -> None:
    assert get_engine() is get_engine()

    await dispose_engine()


async def test_engine_uses_the_configured_url() -> None:
    engine = get_engine()

    assert engine.url.database == "beff_test"
    assert engine.url.drivername == "postgresql+asyncpg"

    await dispose_engine()


async def test_session_factory_does_not_expire_on_commit() -> None:
    """An expired attribute would emit lazy IO from the response serialiser.

    Under asyncio that raises `MissingGreenlet` rather than silently blocking,
    so it is worth pinning.
    """
    factory = create_session_factory(get_engine())

    assert factory.kw["expire_on_commit"] is False

    await dispose_engine()


async def test_session_factory_is_created_once_and_reused() -> None:
    assert get_session_factory() is get_session_factory()

    await dispose_engine()


async def test_dispose_engine_drops_the_cached_engine() -> None:
    first = get_engine()
    await dispose_engine()

    assert get_engine() is not first

    await dispose_engine()
