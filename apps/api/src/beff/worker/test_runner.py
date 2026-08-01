"""Unit tests for the polling loop.

The queue's correctness is tested in `modules/privacy/service/test_export_service.py`
against the repository. What is under test *here* is the loop's own behaviour:
that it stops when asked, that one bad iteration does not kill it, and that it
backs off differently on an empty queue than on a failure.
"""

from __future__ import annotations

import asyncio

import pytest

from beff.worker.runner import WorkerSettings, _sleep_or_stop

FAST = WorkerSettings(idle_seconds=0.01, error_seconds=0.01)


async def test_sleeping_wakes_immediately_when_stopping() -> None:
    """Otherwise SIGTERM takes up to `idle_seconds` to be noticed, which is the
    difference between a clean stop and Docker's 10-second kill."""
    stopping = asyncio.Event()
    stopping.set()

    async with asyncio.timeout(0.5):
        await _sleep_or_stop(stopping, seconds=30.0)


async def test_sleeping_returns_after_the_timeout_when_not_stopping() -> None:
    stopping = asyncio.Event()

    # Must not raise: the timeout is the normal path on an idle queue, and
    # `TimeoutError` escaping here would kill the worker every two seconds.
    await _sleep_or_stop(stopping, seconds=0.01)

    assert not stopping.is_set()


def test_the_idle_backoff_is_shorter_than_the_error_backoff() -> None:
    """An empty queue is normal and should be re-checked promptly; a failure
    means something is wrong and a database that has just come back should not
    be hammered by a worker that was failing in a tight loop."""
    settings = WorkerSettings()

    assert settings.idle_seconds < settings.error_seconds


def test_the_idle_poll_is_faster_than_a_person_reads_a_sentence() -> None:
    """The user is watching "preparing your export" while this runs."""
    assert WorkerSettings().idle_seconds <= 3.0


class FakeSession:
    """Records commits, so a test can assert the unit of work is the job."""

    def __init__(self, outcome: object | Exception) -> None:
        self.outcome = outcome
        self.commits = 0

    async def __aenter__(self) -> FakeSession:
        return self

    async def __aexit__(self, *_: object) -> None:
        return None

    async def commit(self) -> None:
        self.commits += 1


async def test_run_once_commits_exactly_once_per_job(monkeypatch: pytest.MonkeyPatch) -> None:
    """One session per job, not one per loop. A long-lived session would hold
    the claim's row lock across every idle poll rather than just the build."""
    from beff.worker import runner

    session = FakeSession(outcome=None)
    monkeypatch.setattr(runner, "PostgresExportRepository", lambda _s: object())
    monkeypatch.setattr(runner, "PostgresExportBuilder", lambda _s: object())

    class Service:
        def __init__(self, *_: object, **__: object) -> None:
            pass

        async def run_once(self) -> None:
            return None

    monkeypatch.setattr(runner, "ExportService", Service)

    did_work = await runner.run_once(lambda: session)  # type: ignore[arg-type]

    assert did_work is False
    assert session.commits == 1
