"""Alembic environment — async engine, URL from settings.

Lives outside `src/` because it is tooling, not application code: it is excluded
from coverage and is never imported by the running app.
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection, pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from beff.core.config import get_settings
from beff.db.registry import target_metadata as metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# One source of truth for the URL: DATABASE_URL, read through settings. Escaped
# because ConfigParser treats a bare `%` as interpolation and passwords contain
# percent-encoded characters.
config.set_main_option("sqlalchemy.url", get_settings().database_url.replace("%", "%%"))

target_metadata = metadata


def _configure(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # Without this, a column type change is detected but a change to its
        # server default or nullability is not.
        compare_type=True,
        compare_server_default=True,
        # Constraint names come from the metadata naming convention, so alembic
        # must apply the same convention when rendering.
        render_as_batch=False,
        include_schemas=False,
    )


def run_migrations_offline() -> None:
    """Emit SQL to stdout without a database connection (`alembic upgrade --sql`)."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _run_migrations(connection: Connection) -> None:
    _configure(connection)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online_async() -> None:
    """Run migrations against a live database over asyncpg."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Drive the async migration run from a synchronous entry point.

    `alembic upgrade head` is a blocking CLI call, so it normally just needs
    `asyncio.run`. But the integration suite invokes `command.upgrade()` from
    inside an already-running event loop, where `asyncio.run` raises. Handing
    the work to a worker thread — which has no loop of its own — makes the same
    `env.py` serve both callers, rather than the test suite exercising a second
    code path that never ships.
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        asyncio.run(run_migrations_online_async())
        return

    with ThreadPoolExecutor(max_workers=1) as pool:
        pool.submit(lambda: asyncio.run(run_migrations_online_async())).result()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
