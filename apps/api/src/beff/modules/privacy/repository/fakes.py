"""In-memory privacy repositories.

They imitate what the database would fill in and enforce the constraints it
would enforce. A fake more permissive than production turns green unit tests
into false confidence — that has already cost this repo once.
"""

from __future__ import annotations

from datetime import datetime
from itertools import count
from uuid import UUID

from beff.core.ids import uuid7
from beff.db.base import utcnow
from beff.modules.privacy.models import DEFAULT_MAX_ATTEMPTS, ConsentRecord, ExportJob

__all__ = [
    "InMemoryConsentRepository",
    "InMemoryErasureRepository",
    "InMemoryExportRepository",
]


class InMemoryConsentRepository:
    """Append-only, like the table."""

    def __init__(self) -> None:
        self.records: list[ConsentRecord] = []
        self._ids = count(1)

    async def append(self, record: ConsentRecord) -> ConsentRecord:
        record.id = next(self._ids)
        if getattr(record, "recorded_at", None) is None:
            record.recorded_at = utcnow()
        self.records.append(record)
        return record

    async def latest_per_purpose(self, user_id: UUID) -> dict[str, ConsentRecord]:
        latest: dict[str, ConsentRecord] = {}
        # Sorted by (recorded_at, id) so records written inside the same
        # microsecond still resolve deterministically — the identity column is
        # the tiebreak the real query gets from its index.
        for record in sorted(self.records, key=lambda r: (r.recorded_at, r.id)):
            if record.user_id == user_id:
                latest[record.purpose] = record
        return latest


class InMemoryExportRepository:
    """A list that behaves like the queue."""

    def __init__(self) -> None:
        self.jobs: list[ExportJob] = []

    async def add(self, job: ExportJob) -> ExportJob:
        # Everything the INSERT would have filled in. `attempts` and
        # `max_attempts` are `server_default`s, so an unflushed instance has
        # `None` for both — and `job.attempts >= job.max_attempts` against a
        # `None` is a `TypeError` in the dead-letter path, the one branch that
        # only runs when something has already gone wrong.
        if getattr(job, "id", None) is None:
            job.id = uuid7()
        if getattr(job, "status", None) is None:
            job.status = "pending"
        if getattr(job, "requested_at", None) is None:
            job.requested_at = utcnow()
        if getattr(job, "attempts", None) is None:
            job.attempts = 0
        if getattr(job, "max_attempts", None) is None:
            job.max_attempts = DEFAULT_MAX_ATTEMPTS
        self.jobs.append(job)
        return job

    async def latest_for_user(self, user_id: UUID) -> ExportJob | None:
        owned = [job for job in self.jobs if job.user_id == user_id]
        return max(owned, key=lambda j: j.requested_at, default=None)

    async def get_for_user(self, job_id: UUID, user_id: UUID) -> ExportJob | None:
        return next(
            (job for job in self.jobs if job.id == job_id and job.user_id == user_id),
            None,
        )

    async def unfinished_for_user(self, user_id: UUID) -> ExportJob | None:
        return next(
            (
                job
                for job in sorted(self.jobs, key=lambda j: j.requested_at)
                if job.user_id == user_id and job.status in ("pending", "running")
            ),
            None,
        )

    async def claim_next(self, *, now: datetime) -> ExportJob | None:
        job = next(
            (
                candidate
                for candidate in sorted(self.jobs, key=lambda j: j.requested_at)
                if candidate.status == "pending"
            ),
            None,
        )
        if job is None:
            return None
        # Mirrors the real claim: the state change and the attempt increment
        # happen together, so a test cannot accidentally exercise a claim that
        # does not count.
        job.status = "running"
        job.started_at = now
        job.attempts += 1
        return job

    async def finish(self, job: ExportJob) -> ExportJob:
        return job


class InMemoryErasureRepository:
    """Records what was asked of it, so a test can assert the whole sequence."""

    def __init__(self) -> None:
        self.soft_deleted: list[UUID] = []
        self.revoked: list[UUID] = []
        self.exports_deleted: list[UUID] = []
        self.verification_tokens_deleted: list[UUID] = []
        self.email_deliveries_deleted: list[UUID] = []
        self.consent_pseudonymised: list[UUID] = []
        # The order calls arrived in. The erasure service's whole contract is a
        # sequence — sessions die before exports, exports before the account row
        # — and a test that only checks each list is non-empty would pass
        # against any order at all.
        self.calls: list[str] = []

    async def soft_delete_user(self, user_id: UUID, *, at: datetime) -> None:
        self.soft_deleted.append(user_id)
        self.calls.append("soft_delete_user")

    async def revoke_all_token_families(self, user_id: UUID, *, at: datetime) -> int:
        self.revoked.append(user_id)
        self.calls.append("revoke_all_token_families")
        return 1

    async def delete_export_jobs(self, user_id: UUID) -> int:
        self.exports_deleted.append(user_id)
        self.calls.append("delete_export_jobs")
        return 1

    async def delete_verification_tokens(self, user_id: UUID) -> int:
        self.verification_tokens_deleted.append(user_id)
        self.calls.append("delete_verification_tokens")
        return 1

    async def delete_email_deliveries(self, user_id: UUID) -> int:
        self.email_deliveries_deleted.append(user_id)
        self.calls.append("delete_email_deliveries")
        return 1

    async def pseudonymise_consent(self, user_id: UUID) -> int:
        self.consent_pseudonymised.append(user_id)
        self.calls.append("pseudonymise_consent")
        return 1
