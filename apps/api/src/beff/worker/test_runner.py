"""Unit tests for the polling loop.

The queue's correctness is tested in `modules/privacy/service/test_export_service.py`
against the repository. What is under test *here* is the loop's own behaviour:
that it stops when asked, that one bad iteration does not kill it, and that it
backs off differently on an empty queue than on a failure.
"""

from __future__ import annotations

import asyncio
import signal
from types import SimpleNamespace
from typing import Any

import pytest

from beff.core.email import RecordingEmailSender
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


class NullService:
    """Stands in for either queue's service. Always finds nothing to do."""

    def __init__(self, *_: object, **__: object) -> None:
        pass

    async def run_once(self) -> None:
        return None


def _stub_both_queues(runner: object, monkeypatch: pytest.MonkeyPatch) -> None:
    """Replace every collaborator `run_once` constructs, in both queues."""
    for name in (
        "PostgresExportRepository",
        "PostgresExportBuilder",
        "PostgresEmailOutbox",
    ):
        monkeypatch.setattr(runner, name, lambda _s: object())
    monkeypatch.setattr(runner, "ExportService", NullService)
    monkeypatch.setattr(runner, "EmailDeliveryService", NullService)


async def test_run_once_commits_once_per_queue(monkeypatch: pytest.MonkeyPatch) -> None:
    """One session per item, not one per loop — and one *transaction per queue*.

    The second half is the load-bearing part. A shared session would mean an
    export that raises rolls back the email that succeeded beside it, which is
    how at-least-once delivery quietly becomes at-most-sometimes.
    """
    from beff.worker import runner

    sessions: list[FakeSession] = []

    def factory() -> FakeSession:
        session = FakeSession(outcome=None)
        sessions.append(session)
        return session

    _stub_both_queues(runner, monkeypatch)

    did_work = await runner.run_once(factory, sender=RecordingEmailSender())  # type: ignore[arg-type]

    assert did_work is False
    assert len(sessions) == 2, "each queue gets its own session"
    assert [s.commits for s in sessions] == [1, 1]


async def test_run_once_reports_work_when_only_the_email_queue_had_any(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Otherwise the loop backs off for `idle_seconds` with mail still queued.

    Returning `did_export` alone would be the easy bug here: the export queue is
    empty almost always, so the worker would sleep two seconds between every
    single message and a registration confirmation would trickle out.
    """
    from beff.worker import runner

    _stub_both_queues(runner, monkeypatch)

    class Sent:
        def __init__(self, *_: object, **__: object) -> None:
            pass

        async def run_once(self) -> SimpleNamespace:
            return SimpleNamespace(id=1, purpose="email_verification", status="sent", attempts=1)

    monkeypatch.setattr(runner, "EmailDeliveryService", Sent)

    did_work = await runner.run_once(
        lambda: FakeSession(outcome=None),  # type: ignore[arg-type]
        sender=RecordingEmailSender(),
    )

    assert did_work is True


# ─────────────────────────────────────────────────────────────────────────────
# The loop itself.
#
# `run_forever` owns three things nothing else can be asked about: that it stops
# on a signal, that one raised iteration does not kill it, and that the engine is
# disposed on the way out however the loop ended. All three are only observable
# by driving the real function, so the collaborators it reaches for at module
# scope — the engine, the settings, the sender — are what get replaced.
# ─────────────────────────────────────────────────────────────────────────────


def _stub_worker_environment(runner: object, monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Detach `run_forever` from the process: no engine, no config, no transport.

    Returns the list `dispose_engine` appends to, so a test can assert the
    cleanup ran — which is the assertion that would otherwise need a real pool.
    """
    disposals: list[str] = []

    async def dispose() -> None:
        disposals.append("disposed")

    monkeypatch.setattr(runner, "get_engine", lambda: object())
    monkeypatch.setattr(runner, "create_session_factory", lambda _engine: object())
    monkeypatch.setattr(runner, "get_settings", lambda: object())
    monkeypatch.setattr(runner, "build_email_sender", lambda _settings: RecordingEmailSender())
    monkeypatch.setattr(runner, "dispose_engine", dispose)
    return disposals


def _capture_signal_handlers(monkeypatch: pytest.MonkeyPatch) -> dict[int, Any]:
    """Hold on to the handlers `run_forever` installs.

    Every test below that needs the loop to stop does it by *calling the
    handler*, which is the same edge SIGTERM arrives on. The alternative —
    replacing `asyncio.Event` with one the test owns — reaches inside a stdlib
    module for the duration of the test and proves less: it would exercise the
    loop's stop check while leaving the wiring from signal to event untested,
    which is the half that has somewhere to go wrong.
    """
    handlers: dict[int, Any] = {}
    monkeypatch.setattr(signal, "signal", lambda sig, handler: handlers.__setitem__(sig, handler))
    return handlers


async def test_the_loop_polls_until_it_is_asked_to_stop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The stop is cooperative, and it is checked between iterations.

    Driven by having `run_once` request the stop itself on its third call, which
    is the same edge SIGTERM arrives on — the handler only sets an event, and
    everything after that is this loop noticing.
    """
    from beff.worker import runner

    disposals = _stub_worker_environment(runner, monkeypatch)
    handlers = _capture_signal_handlers(monkeypatch)
    calls = 0

    async def run_once(_factory: object, *, sender: object) -> bool:
        nonlocal calls
        calls += 1
        if calls == 3:
            handlers[signal.SIGTERM](signal.SIGTERM, None)
        return True

    monkeypatch.setattr(runner, "run_once", run_once)

    async with asyncio.timeout(5):
        await runner.run_forever(FAST)

    assert calls == 3
    assert disposals == ["disposed"], "the engine is disposed however the loop ends"


async def test_one_failing_iteration_does_not_kill_the_worker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A dropped connection or an outright bug must not end the process.

    The job itself is already marked failed or requeued by its service, so the
    only right response here is to back off and carry on. A worker that exits
    instead leaves every queued export and every verification mail stranded
    until somebody notices the container is gone.
    """
    from beff.worker import runner

    disposals = _stub_worker_environment(runner, monkeypatch)
    handlers = _capture_signal_handlers(monkeypatch)
    calls = 0

    async def run_once(_factory: object, *, sender: object) -> bool:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError("the database went away")
        handlers[signal.SIGINT](signal.SIGINT, None)
        return True

    monkeypatch.setattr(runner, "run_once", run_once)

    async with asyncio.timeout(5):
        await runner.run_forever(FAST)

    assert calls == 2, "it kept going after the exception"
    assert disposals == ["disposed"]


async def test_an_empty_queue_backs_off_and_a_failure_backs_off_further(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The two backoffs are different numbers for different reasons.

    Asserting on the *durations requested* rather than on elapsed time: a test
    that measures the wall clock either sleeps for real or is flaky, and neither
    proves which branch was taken.
    """
    from beff.worker import runner

    _stub_worker_environment(runner, monkeypatch)
    handlers = _capture_signal_handlers(monkeypatch)
    waits: list[float] = []
    calls = 0

    async def run_once(_factory: object, *, sender: object) -> bool:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError("boom")
        if calls == 2:
            return False  # empty queue
        handlers[signal.SIGTERM](signal.SIGTERM, None)
        return True

    async def sleep_or_stop(_stopping: asyncio.Event, seconds: float) -> None:
        waits.append(seconds)

    monkeypatch.setattr(runner, "run_once", run_once)
    monkeypatch.setattr(runner, "_sleep_or_stop", sleep_or_stop)

    async with asyncio.timeout(5):
        await runner.run_forever(WorkerSettings(idle_seconds=2.0, error_seconds=10.0))

    assert waits == [10.0, 2.0], "error backoff first, then the idle one"


async def test_the_engine_is_disposed_even_when_the_loop_raises(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`CancelledError` is not an `Exception`, so it goes past the guard.

    That is the shutdown path — the task is cancelled — and the `finally` is the
    only thing that returns the connection pool. Losing it leaks a pool per
    restart, which looks like a database problem rather than a worker one.
    """
    from beff.worker import runner

    disposals = _stub_worker_environment(runner, monkeypatch)

    async def run_once(_factory: object, *, sender: object) -> bool:
        raise asyncio.CancelledError

    monkeypatch.setattr(runner, "run_once", run_once)

    with pytest.raises(asyncio.CancelledError):
        await runner.run_forever(FAST)

    assert disposals == ["disposed"]


def test_installing_signal_handlers_off_the_main_thread_is_survivable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`signal.signal` raises `ValueError` outside the main thread.

    The loop still works there — it just cannot install handlers — so the
    suppression is deliberate rather than defensive. Without it, running the
    worker inside a thread (which is how a test harness or an embedded runner
    would do it) dies on startup with an error about signals.
    """
    from beff.worker import runner

    disposals = _stub_worker_environment(runner, monkeypatch)

    def refuse(*_: object) -> None:
        raise ValueError("signal only works in main thread")

    monkeypatch.setattr(signal, "signal", refuse)

    async def run_once(_factory: object, *, sender: object) -> bool:
        raise asyncio.CancelledError

    monkeypatch.setattr(runner, "run_once", run_once)

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(runner.run_forever(FAST))

    assert disposals == ["disposed"]


async def test_the_signal_handler_asks_the_loop_to_stop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """SIGTERM is `docker compose down`.

    The handler must only *set* the event: doing the shutdown work inside a
    signal handler runs it on whatever stack was interrupted, and an async
    cleanup cannot be started from there at all.
    """
    from beff.worker import runner

    _stub_worker_environment(runner, monkeypatch)
    handlers = _capture_signal_handlers(monkeypatch)
    calls = 0

    async def run_once(_factory: object, *, sender: object) -> bool:
        nonlocal calls
        calls += 1
        handlers[signal.SIGTERM](signal.SIGTERM, None)
        return True

    monkeypatch.setattr(runner, "run_once", run_once)

    async with asyncio.timeout(5):
        await runner.run_forever(FAST)

    assert calls == 1, "the loop stopped on the iteration the handler fired"
    assert set(handlers) == {signal.SIGTERM, signal.SIGINT}
