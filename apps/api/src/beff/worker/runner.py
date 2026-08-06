"""The polling loop that drains the background queues.

Two of them now: GDPR exports and outbound email. Deliberately boring. The
interesting concurrency is in the SQL — `FOR UPDATE SKIP LOCKED` is what lets
two of these run side by side without either blocking on the other's row — so
this file only has to decide *when* to ask and *when to stop asking*.
"""

from __future__ import annotations

import asyncio
import contextlib
import signal
from dataclasses import dataclass
from types import FrameType

import structlog
from sqlalchemy.ext.asyncio import AsyncSession as Session
from sqlalchemy.ext.asyncio import async_sessionmaker

from beff.core.config import get_settings
from beff.core.email import (
    EmailDeliveryService,
    EmailSender,
    PostgresEmailOutbox,
    build_email_sender,
)
from beff.db import create_session_factory, dispose_engine, get_engine
from beff.modules.privacy.repository import PostgresExportRepository
from beff.modules.privacy.service import ExportService, PostgresExportBuilder

__all__ = ["WorkerSettings", "run_forever", "run_once"]

log = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class WorkerSettings:
    """How hard to poll.

    `idle_seconds` is the only tuning knob that matters. Too low and the worker
    spins on an empty table; too high and a user watching the profile screen
    waits for nothing. Two seconds is well inside the time it takes someone to
    read the "preparing your export" message.
    """

    idle_seconds: float = 2.0
    # After a *failure* rather than an empty queue. Backing off further means a
    # database that has just come back does not get hammered by a worker that
    # has been failing in a tight loop.
    error_seconds: float = 10.0


async def run_once(factory: async_sessionmaker[Session], *, sender: EmailSender) -> bool:
    """Drain at most one item from each queue. Returns whether there was work.

    Both queues, not one — and each in its own session and its own transaction.
    A shared one would mean an export that fails rolls back the email that
    succeeded beside it, which is how at-least-once turns into
    at-most-sometimes.

    One session per item, not one per loop. A long-lived session would hold a
    connection and an open transaction across every idle poll, and the row lock
    taken by the claim would be held for the whole time rather than for the
    work.
    """
    did_export = await _run_one_export(factory)
    did_email = await _run_one_email(factory, sender=sender)
    return did_export or did_email


async def _run_one_export(factory: async_sessionmaker[Session]) -> bool:
    async with factory() as session:
        service = ExportService(
            PostgresExportRepository(session),
            builder=PostgresExportBuilder(session),
        )
        job = await service.run_once()
        # `run_once` mutates the row; the unit of work is the job, so this is
        # the only place that commits. A crash before here leaves the job
        # `pending` with its attempt already counted, which is the behaviour the
        # dead-letter ceiling is built on.
        await session.commit()

    if job is not None:
        log.info(
            "export_job.processed",
            job_id=str(job.id),
            status=job.status,
            attempts=job.attempts,
        )
    return job is not None


async def _run_one_email(factory: async_sessionmaker[Session], *, sender: EmailSender) -> bool:
    async with factory() as session:
        service = EmailDeliveryService(PostgresEmailOutbox(session), sender=sender)
        delivery = await service.run_once()
        await session.commit()

    if delivery is not None:
        log.info(
            "email_delivery.processed",
            delivery_id=delivery.id,
            purpose=delivery.purpose,
            status=delivery.status,
            attempts=delivery.attempts,
            # The recipient is deliberately absent. An email address is personal
            # data and this line goes to stdout, into whatever aggregates logs —
            # the delivery id is enough to find the row when someone needs to.
        )
    return delivery is not None


async def run_forever(settings: WorkerSettings | None = None) -> None:
    """Poll until asked to stop.

    Handles SIGTERM and SIGINT so `docker compose down` is a clean shutdown
    rather than a killed process mid-build. A job interrupted here is left
    `running` with its attempt counted — it does not silently vanish, and the
    ceiling still applies.
    """
    config = settings or WorkerSettings()
    factory = create_session_factory(get_engine())
    # Built once, outside the loop. `build_email_sender` warns when no transport
    # is configured, and doing that per poll would emit the same warning every
    # two seconds forever.
    sender = build_email_sender(get_settings())
    stopping = asyncio.Event()

    def request_stop(signum: int, _frame: FrameType | None) -> None:
        log.info("worker.stopping", signal=signal.Signals(signum).name)
        stopping.set()

    for sig in (signal.SIGTERM, signal.SIGINT):
        with contextlib.suppress(ValueError):
            # `ValueError` when not on the main thread — the loop still works,
            # it just cannot install handlers.
            signal.signal(sig, request_stop)

    log.info("worker.started", idle_seconds=config.idle_seconds)

    try:
        while not stopping.is_set():
            try:
                did_work = await run_once(factory, sender=sender)
            except Exception:
                # Never let one bad job kill the worker. The job itself is
                # already marked failed or requeued by the service; this is the
                # unexpected case — a dropped connection, a bug — and the right
                # response is to back off and carry on.
                log.exception("worker.iteration_failed")
                await _sleep_or_stop(stopping, config.error_seconds)
                continue

            if not did_work:
                await _sleep_or_stop(stopping, config.idle_seconds)
    finally:
        await dispose_engine()
        log.info("worker.stopped")


async def _sleep_or_stop(stopping: asyncio.Event, seconds: float) -> None:
    """Sleep, but wake immediately on shutdown.

    A plain `asyncio.sleep` would make SIGTERM take up to `idle_seconds` to be
    noticed, which is the difference between a clean stop and Docker's 10-second
    kill.
    """
    with contextlib.suppress(TimeoutError):
        await asyncio.wait_for(stopping.wait(), timeout=seconds)


def main() -> None:  # pragma: no cover - entry point
    """`python -m beff.worker`."""
    asyncio.run(run_forever())


if __name__ == "__main__":  # pragma: no cover
    main()
