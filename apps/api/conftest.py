"""Fixtures shared by every test tree.

Lives at the package root because pytest only applies a `conftest.py` to its own
directory and below. Co-located unit tests under `src/` and integration tests
under `tests/` both need these, so a conftest inside either tree would be
invisible to the other.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine

from beff.core.config import get_settings
from beff.db import create_session_factory
from beff.main import create_app

__all__ = [
    "alembic_config",
    "client",
    "db_engine",
    "db_session",
    "postgres_url",
]

API_ROOT = Path(__file__).parent


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """An HTTP client bound directly to the ASGI app, no network involved.

    Note: `AsyncClient(app=...)` was removed in httpx 0.28 - the shortcut shown
    in most FastAPI tutorials no longer works. `ASGITransport` is the current
    form.
    """
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ─────────────────────────────────────────────────────────────────────────────
# Integration fixtures - a real PostgreSQL, started once per session.
#
# Session-scoped because starting a container costs seconds and isolation comes
# from recreating the schema per test, not from a fresh container. Nothing below
# is pulled in except by a test marked `@pytest.mark.integration`, so the unit
# suite never touches Docker.
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def postgres_url() -> Iterator[str]:
    """A live PostgreSQL 16, matching the version in `docker-compose.yml`.

    `TEST_DATABASE_URL` short-circuits the container, which is how CI can run
    these against a service container instead of docker-in-docker.
    """
    override = os.environ.get("TEST_DATABASE_URL")
    if override:
        yield override
        return

    # Imported lazily so that merely collecting the unit suite does not require
    # Docker to be installed.
    from testcontainers.community.postgres import PostgresContainer

    with PostgresContainer("postgres:16-alpine", driver="asyncpg") as container:
        yield container.get_connection_url()


@pytest.fixture(scope="session")
def alembic_config(postgres_url: str) -> Iterator[Config]:
    """An Alembic config pointed at the test database.

    `migrations/env.py` reads the URL from settings, so `DATABASE_URL` is what
    actually redirects it; `sqlalchemy.url` is set too so the config is
    self-describing if something inspects it directly.
    """
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = postgres_url
    get_settings.cache_clear()

    config = Config(str(API_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(API_ROOT / "migrations"))
    config.set_main_option("sqlalchemy.url", postgres_url.replace("%", "%%"))

    yield config

    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()


@pytest.fixture
async def db_engine(postgres_url: str, alembic_config: Config) -> AsyncIterator[AsyncEngine]:
    """An engine against a freshly migrated schema.

    The schema is built by running the real migrations rather than
    `metadata.create_all`. Those are different code paths and only one of them
    ships: a suite that creates tables from metadata passes happily while the
    migration production actually runs is broken.
    """
    command.upgrade(alembic_config, "head")
    engine = create_async_engine(postgres_url)
    try:
        yield engine
    finally:
        await engine.dispose()
        command.downgrade(alembic_config, "base")


@pytest.fixture
async def db_session(db_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """A session on the migrated schema."""
    factory = create_session_factory(db_engine)
    async with factory() as session:
        yield session
