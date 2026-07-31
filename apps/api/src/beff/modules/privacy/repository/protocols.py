"""What the privacy services need from storage."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from beff.modules.privacy.models import ConsentRecord, ExportJob

__all__ = ["ConsentRepository", "ErasureRepository", "ExportRepository"]


class ConsentRepository(Protocol):
    """Append-only. Note the absence of an `update`.

    That absence is the design. Consent must be provable — what was agreed to,
    when, and against which policy version (Art. 7(1)) — and an `UPDATE` on a
    boolean destroys the only evidence of the previous state. The current state
    is derived by reading the latest record per purpose.
    """

    async def append(self, record: ConsentRecord) -> ConsentRecord: ...

    async def latest_per_purpose(self, user_id: UUID) -> dict[str, ConsentRecord]: ...


class ExportRepository(Protocol):
    async def add(self, job: ExportJob) -> ExportJob: ...

    async def latest_for_user(self, user_id: UUID) -> ExportJob | None: ...

    async def get_for_user(self, job_id: UUID, user_id: UUID) -> ExportJob | None: ...

    async def unfinished_for_user(self, user_id: UUID) -> ExportJob | None: ...

    async def claim_next(self, *, now: datetime) -> ExportJob | None:
        """Take one pending job, or return `None`.

        Implemented with `SELECT ... FOR UPDATE SKIP LOCKED` (ADR-0006): two
        workers polling at once must never claim the same row, and `SKIP LOCKED`
        is what lets the second one step over the first's lock instead of
        blocking behind it.
        """
        ...

    async def finish(self, job: ExportJob) -> ExportJob: ...


class ErasureRepository(Protocol):
    """Art. 17, and the brief's mandated offboarding."""

    async def soft_delete_user(self, user_id: UUID, *, at: datetime) -> None: ...

    async def revoke_all_token_families(self, user_id: UUID, *, at: datetime) -> int: ...

    async def delete_export_jobs(self, user_id: UUID) -> int: ...

    async def pseudonymise_consent(self, user_id: UUID) -> int: ...
