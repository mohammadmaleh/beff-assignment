"""PostgreSQL implementations of the privacy repositories."""

from __future__ import annotations

from datetime import datetime
from typing import Any, cast
from uuid import UUID

from sqlalchemy import CursorResult, delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from beff.core.email.model import EmailDelivery
from beff.modules.auth.models import (
    REVOKED_BY_ERASURE,
    EmailVerificationToken,
    RefreshToken,
    User,
)
from beff.modules.privacy.models import ConsentRecord, ExportJob

__all__ = [
    "PostgresConsentRepository",
    "PostgresErasureRepository",
    "PostgresExportRepository",
]


def _rowcount(result: object) -> int:
    """`rowcount` lives on `CursorResult`, which the stubs do not narrow to."""
    return cast("CursorResult[Any]", result).rowcount


class PostgresConsentRepository:
    """Satisfies `ConsentRepository` structurally."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def append(self, record: ConsentRecord) -> ConsentRecord:
        self._session.add(record)
        await self._session.flush()
        return record

    async def latest_per_purpose(self, user_id: UUID) -> dict[str, ConsentRecord]:
        """The newest record for each purpose.

        `DISTINCT ON` rather than a subquery per purpose: one index-ordered scan
        of `ix_consent_records_user_id_purpose_recorded_at` answers the whole
        question. PostgreSQL-only, which this project is by decision.
        """
        result = await self._session.execute(
            select(ConsentRecord)
            .where(ConsentRecord.user_id == user_id)
            .distinct(ConsentRecord.purpose)
            .order_by(ConsentRecord.purpose, ConsentRecord.recorded_at.desc())
        )
        return {record.purpose: record for record in result.scalars().all()}


class PostgresExportRepository:
    """Satisfies `ExportRepository` structurally."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, job: ExportJob) -> ExportJob:
        self._session.add(job)
        await self._session.flush()
        return job

    async def latest_for_user(self, user_id: UUID) -> ExportJob | None:
        result = await self._session.execute(
            select(ExportJob)
            .where(ExportJob.user_id == user_id)
            .order_by(ExportJob.requested_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_for_user(self, job_id: UUID, user_id: UUID) -> ExportJob | None:
        """Scoped by owner in the query itself.

        Fetching by id and checking ownership afterwards is the same thing until
        somebody deletes the check; expressing it as a predicate means there is
        no separate check to delete.
        """
        result = await self._session.execute(
            select(ExportJob).where(ExportJob.id == job_id, ExportJob.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def unfinished_for_user(self, user_id: UUID) -> ExportJob | None:
        result = await self._session.execute(
            select(ExportJob)
            .where(ExportJob.user_id == user_id, ExportJob.status.in_(("pending", "running")))
            .order_by(ExportJob.requested_at)
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def claim_next(self, *, now: datetime) -> ExportJob | None:
        """Take the oldest pending job, skipping any another worker holds.

        `FOR UPDATE SKIP LOCKED` is the whole queue (ADR-0006). Without
        `SKIP LOCKED` a second worker blocks on the first one's row and the pool
        serialises; with it, each worker walks past what is already claimed.

        `attempts` is incremented here rather than on failure. A worker
        SIGKILLed between claiming and failing never writes "that attempt
        failed", so counting on the way in is the only count that survives a
        crash — and it is what makes the dead-letter ceiling meaningful.
        """
        result = await self._session.execute(
            select(ExportJob)
            .where(ExportJob.status == "pending")
            .order_by(ExportJob.requested_at)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        job = result.scalar_one_or_none()
        if job is None:
            return None

        job.status = "running"
        job.started_at = now
        job.attempts += 1
        await self._session.flush()
        return job

    async def finish(self, job: ExportJob) -> ExportJob:
        await self._session.flush()
        return job


class PostgresErasureRepository:
    """Satisfies `ErasureRepository` structurally."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def soft_delete_user(self, user_id: UUID, *, at: datetime) -> None:
        """Stamp `deleted_at`.

        Soft rather than hard, because the partial unique index
        (`WHERE deleted_at IS NULL`) is what frees the email address for
        re-registration while keeping the row's foreign keys intact. The
        personal data on the row is scrubbed in the same statement — a
        `deleted_at` that leaves the email and name readable is not erasure.
        """
        await self._session.execute(
            update(User)
            .where(User.id == user_id, User.deleted_at.is_(None))
            .values(
                deleted_at=at,
                # Deterministic and unique, so the row still satisfies its own
                # constraints without holding anything that identifies a person.
                email=f"erased+{user_id!s}@invalid",
                display_name="Erased account",
                password_hash="",
            )
        )
        await self._session.flush()

    async def revoke_all_token_families(self, user_id: UUID, *, at: datetime) -> int:
        """A live session outliving the account it belongs to is the bug here."""
        result = await self._session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=at, revoked_reason=REVOKED_BY_ERASURE)
        )
        await self._session.flush()
        return _rowcount(result)

    async def delete_export_jobs(self, user_id: UUID) -> int:
        """Hard delete. An export is a complete copy of everything being erased;
        keeping it would make the erasure cosmetic."""
        result = await self._session.execute(delete(ExportJob).where(ExportJob.user_id == user_id))
        await self._session.flush()
        return _rowcount(result)

    async def delete_email_deliveries(self, user_id: UUID) -> int:
        """Hard delete. Every row carries the recipient address in the clear,
        and there is no basis for keeping it once the account is gone."""
        result = await self._session.execute(
            delete(EmailDelivery).where(EmailDelivery.user_id == user_id)
        )
        await self._session.flush()
        return _rowcount(result)

    async def delete_verification_tokens(self, user_id: UUID) -> int:
        """Hard delete.

        Not only data minimisation: an unconsumed token is a live credential
        for an address that is about to be freed for re-registration. Leaving
        one behind would let an old link act on a new account.
        """
        result = await self._session.execute(
            delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id)
        )
        await self._session.flush()
        return _rowcount(result)

    async def pseudonymise_consent(self, user_id: UUID) -> int:
        """Keep the records, drop what identifies the person.

        Consent records are retained on a different legal basis from everything
        else here — Art. 6(1)(c), the accountability obligation in Art. 7(1) —
        so they survive erasure. What must not survive is the ability to link
        them back to a natural person, which is the `ip_hash` and the
        `country_code`. The `user_id` stays because the row is meaningless
        without it and it now points at an erased user carrying no personal
        data.
        """
        result = await self._session.execute(
            update(ConsentRecord)
            .where(ConsentRecord.user_id == user_id)
            .values(ip_hash=None, country_code=None)
        )
        await self._session.flush()
        return _rowcount(result)
