"""Art. 15 access and Art. 20 portability, on a Postgres-backed queue."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from typing import Any, Protocol
from uuid import UUID

from beff.db.base import utcnow
from beff.modules.privacy.errors import ExportNotFoundError, ExportNotReadyError
from beff.modules.privacy.models import ExportJob
from beff.modules.privacy.repository import ExportRepository

__all__ = ["ExportBuilder", "ExportService"]


class ExportBuilder(Protocol):
    """Assembles the document for one data subject.

    A protocol rather than a concrete class so the queue mechanics can be tested
    against a builder that fails on demand - the interesting behaviour is what
    happens on the second attempt, not what the JSON looks like.
    """

    async def build(self, user_id: UUID) -> dict[str, Any]: ...


class PermanentExportError(Exception):
    """A failure that retrying cannot fix.

    Retrying a validation error just burns the attempt budget and delays the
    dead-letter path. Transient failures - a dropped connection - are the ones
    at-least-once delivery exists for.
    """


class ExportService:
    """Requesting, reading and building exports."""

    def __init__(
        self,
        jobs: ExportRepository,
        *,
        builder: ExportBuilder | None = None,
        clock: Callable[[], datetime] = utcnow,
    ) -> None:
        self._jobs = jobs
        self._builder = builder
        self._clock = clock

    async def request(self, user_id: UUID) -> ExportJob:
        """Queue an export, or hand back the one already in flight.

        **This is the idempotency boundary.** A user who double-clicks, or whose
        browser retries the POST, must not end up with two workers building the
        same document - so an unfinished job for that user *is* the response.
        Art. 15 gives a right to a copy, not to a queue full of duplicates.
        """
        in_flight = await self._jobs.unfinished_for_user(user_id)
        if in_flight is not None:
            return in_flight

        return await self._jobs.add(ExportJob(user_id=user_id, status="pending"))

    async def latest(self, user_id: UUID) -> ExportJob | None:
        return await self._jobs.latest_for_user(user_id)

    async def document(self, job_id: UUID, user_id: UUID) -> dict[str, Any]:
        """The finished export, for its owner only."""
        job = await self._jobs.get_for_user(job_id, user_id)
        if job is None:
            # Not "403 not yours" - that would confirm the export exists to
            # anyone who guessed an id.
            raise ExportNotFoundError
        if job.status != "ready" or job.payload is None:
            raise ExportNotReadyError(job.status)
        return job.payload

    async def run_once(self) -> ExportJob | None:
        """Claim one job and build it. Returns `None` when the queue is empty.

        Idempotent by construction: the claim moves the row out of `pending` in
        the same transaction that increments `attempts`, so a replay finds
        nothing to claim, and a job that reaches `ready` is never re-claimed. A
        worker killed mid-build leaves the row `running` with its attempt
        already counted, which is what makes the ceiling honest.
        """
        if self._builder is None:
            raise RuntimeError("This ExportService was constructed without a builder.")

        now = self._clock()
        job = await self._jobs.claim_next(now=now)
        if job is None:
            return None

        try:
            payload = await self._builder.build(job.user_id)
        except PermanentExportError as exc:
            return await self._fail(job, str(exc), permanent=True)
        except Exception as exc:
            return await self._fail(job, str(exc), permanent=False)

        job.payload = payload
        job.status = "ready"
        job.completed_at = now
        job.failure_reason = None
        return await self._jobs.finish(job)

    async def _fail(self, job: ExportJob, reason: str, *, permanent: bool) -> ExportJob:
        """Back onto the queue, or into the dead-letter state.

        `failed` is terminal and visible to the user, who can request a fresh
        export. Silently retrying forever would leave the profile screen saying
        "preparing your export" indefinitely, which is worse than an error.
        """
        exhausted = job.attempts >= job.max_attempts
        job.status = "failed" if permanent or exhausted else "pending"
        job.failure_reason = reason[:500]
        if job.status == "failed":
            job.completed_at = self._clock()
        return await self._jobs.finish(job)
