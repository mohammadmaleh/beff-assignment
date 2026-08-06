"""Unit tests for the export queue.

The interesting behaviour is not what the JSON looks like - it is what happens
on the second attempt, on a replay, and when a worker dies mid-build.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import pytest

from beff.modules.privacy.errors import ExportNotFoundError, ExportNotReadyError
from beff.modules.privacy.repository import InMemoryExportRepository
from beff.modules.privacy.service import ExportService, PermanentExportError

USER = uuid4()
NOW = datetime(2026, 7, 31, 12, 0, tzinfo=UTC)


class RecordingBuilder:
    """Counts its calls, and can be told to fail."""

    def __init__(self, *, fail: Exception | None = None) -> None:
        self.calls: list[Any] = []
        self.fail = fail

    async def build(self, user_id: Any) -> dict[str, Any]:
        self.calls.append(user_id)
        if self.fail is not None:
            raise self.fail
        return {"subject": {"id": str(user_id)}}


@pytest.fixture
def jobs() -> InMemoryExportRepository:
    return InMemoryExportRepository()


def service(
    jobs: InMemoryExportRepository, builder: RecordingBuilder | None = None
) -> ExportService:
    return ExportService(jobs, builder=builder, clock=lambda: NOW)


# ── Requesting ───────────────────────────────────────────────────────────────


async def test_requesting_queues_a_pending_job(jobs: InMemoryExportRepository) -> None:
    job = await service(jobs).request(USER)

    assert job.status == "pending"
    assert job.user_id == USER


async def test_requesting_twice_produces_one_job(jobs: InMemoryExportRepository) -> None:
    """**The idempotency requirement.**

    A double-click, or a browser retrying the POST, must not put two workers on
    the same document. Art. 15 gives a right to a copy, not to a queue full of
    duplicates.
    """
    first = await service(jobs).request(USER)
    second = await service(jobs).request(USER)

    assert first.id == second.id
    assert len(jobs.jobs) == 1


async def test_a_finished_export_does_not_block_a_new_request(
    jobs: InMemoryExportRepository,
) -> None:
    """Idempotency is scoped to jobs still in flight. Once one is ready, asking
    again is a genuinely new request."""
    exports = service(jobs, RecordingBuilder())
    await exports.request(USER)
    await exports.run_once()

    await exports.request(USER)

    assert len(jobs.jobs) == 2


async def test_two_users_get_their_own_jobs(jobs: InMemoryExportRepository) -> None:
    other = uuid4()
    await service(jobs).request(USER)
    await service(jobs).request(other)

    assert len(jobs.jobs) == 2


# ── Building ─────────────────────────────────────────────────────────────────


async def test_running_the_queue_builds_and_marks_ready(
    jobs: InMemoryExportRepository,
) -> None:
    exports = service(jobs, RecordingBuilder())
    await exports.request(USER)

    job = await exports.run_once()

    assert job is not None
    assert job.status == "ready"
    assert job.payload is not None
    assert job.completed_at == NOW


async def test_an_empty_queue_returns_nothing(jobs: InMemoryExportRepository) -> None:
    assert await service(jobs, RecordingBuilder()).run_once() is None


async def test_replaying_the_worker_produces_one_export(
    jobs: InMemoryExportRepository,
) -> None:
    """**The at-least-once requirement.**

    Retries happen - that is what at-least-once delivery means. The claim moves
    the row out of `pending` in the same step that counts the attempt, so a
    second pass finds nothing to claim and the builder is never run twice.
    """
    builder = RecordingBuilder()
    exports = service(jobs, builder)
    await exports.request(USER)

    await exports.run_once()
    second = await exports.run_once()

    assert second is None
    assert len(builder.calls) == 1
    assert len([job for job in jobs.jobs if job.status == "ready"]) == 1


# ── Failure ──────────────────────────────────────────────────────────────────


async def test_a_transient_failure_goes_back_on_the_queue(
    jobs: InMemoryExportRepository,
) -> None:
    exports = service(jobs, RecordingBuilder(fail=ConnectionError("database went away")))
    await exports.request(USER)

    job = await exports.run_once()

    assert job is not None
    assert job.status == "pending"
    assert job.attempts == 1


async def test_a_permanent_failure_is_not_retried(jobs: InMemoryExportRepository) -> None:
    """Retrying a validation error burns the attempt budget and delays the
    dead-letter path for no chance of success."""
    exports = service(jobs, RecordingBuilder(fail=PermanentExportError("no such user")))
    await exports.request(USER)

    job = await exports.run_once()

    assert job is not None
    assert job.status == "failed"
    assert job.attempts == 1


async def test_a_job_that_keeps_failing_reaches_the_dead_letter_state(
    jobs: InMemoryExportRepository,
) -> None:
    """Without a ceiling, a deterministically failing job is retried forever and
    the profile screen says "preparing your export" indefinitely."""
    exports = service(jobs, RecordingBuilder(fail=ConnectionError("still down")))
    await exports.request(USER)

    for _ in range(3):
        await exports.run_once()

    job = jobs.jobs[0]
    assert job.status == "failed"
    assert job.attempts == 3
    assert job.failure_reason is not None


async def test_the_attempt_is_counted_on_the_claim_not_on_the_failure(
    jobs: InMemoryExportRepository,
) -> None:
    """A worker SIGKILLed between claiming and failing never writes "that
    attempt failed", so counting on the way in is the only count that survives a
    crash."""
    exports = service(jobs, RecordingBuilder())
    await exports.request(USER)

    await jobs.claim_next(now=NOW)

    assert jobs.jobs[0].attempts == 1
    assert jobs.jobs[0].status == "running"


# ── Reading ──────────────────────────────────────────────────────────────────


async def test_the_owner_can_download_a_ready_export(
    jobs: InMemoryExportRepository,
) -> None:
    exports = service(jobs, RecordingBuilder())
    job = await exports.request(USER)
    await exports.run_once()

    document = await exports.document(job.id, USER)

    assert document["subject"]["id"] == str(USER)


async def test_someone_else_cannot_download_it(jobs: InMemoryExportRepository) -> None:
    """And the error is "not found", not "not yours" - the second would confirm
    the export exists to anyone who guessed an id."""
    exports = service(jobs, RecordingBuilder())
    job = await exports.request(USER)
    await exports.run_once()

    with pytest.raises(ExportNotFoundError):
        await exports.document(job.id, uuid4())


async def test_an_unfinished_export_cannot_be_downloaded(
    jobs: InMemoryExportRepository,
) -> None:
    exports = service(jobs, RecordingBuilder())
    job = await exports.request(USER)

    with pytest.raises(ExportNotReadyError):
        await exports.document(job.id, USER)


async def test_a_missing_export_is_not_found(jobs: InMemoryExportRepository) -> None:
    with pytest.raises(ExportNotFoundError):
        await service(jobs, RecordingBuilder()).document(uuid4(), USER)
