"""The `export_jobs` table — Art. 15 access and Art. 20 portability, queued.

Building an export means reading every table that holds the data subject's
personal data, so it is not something to do inside a request. The job is a row;
the queue is `SELECT ... FOR UPDATE SKIP LOCKED` over that row (ADR-0006). There
is no Redis, and adding one would buy nothing at pre-launch volume that a table
does not already give: persistence, retries, idempotency and a dead-letter path.

The finished document lives in `payload` rather than on a disk or in object
storage. That is deliberate at this size — it keeps the export inside the same
transaction boundary and the same erasure path as everything else it describes,
so `DELETE FROM export_jobs` is a complete deletion with no orphaned file to
find later.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Final
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from beff.core.ids import uuid7
from beff.db.base import Base, sql_value_list, utcnow

__all__ = [
    "DEFAULT_MAX_ATTEMPTS",
    "EXPORT_JOB_STATUSES",
    "FAILURE_REASON_MAX_LENGTH",
    "TERMINAL_EXPORT_JOB_STATUSES",
    "ExportJob",
]

# `pending` and `running` are the queue's; `ready` and `failed` are terminal.
# TEXT + CHECK, never a PostgreSQL ENUM — a new state must not require an
# `ALTER TYPE` that cannot be rolled back.
EXPORT_JOB_STATUSES: Final = ("pending", "running", "ready", "failed")

TERMINAL_EXPORT_JOB_STATUSES: Final = ("ready", "failed")

# Three attempts, then the dead-letter path. At-least-once delivery means a
# worker can die mid-job and the row goes back on the queue; without a ceiling a
# job that fails deterministically would be retried until the heat death of the
# universe.
DEFAULT_MAX_ATTEMPTS: Final = 3

FAILURE_REASON_MAX_LENGTH: Final = 500


class ExportJob(Base):
    """One data subject's request for a copy of their data.

    The id is handed to the client and appears in the download URL, so it is
    UUIDv7 — opaque, non-enumerable, and still index-ordered by creation time
    (ADR-0010).

    No `TimestampMixin`: `requested_at`, `started_at` and `completed_at` are the
    lifecycle, and a generic `updated_at` alongside them would be a fourth
    timestamp that means nothing in particular.
    """

    __tablename__ = "export_jobs"
    __table_args__ = (
        CheckConstraint(f"status IN {sql_value_list(EXPORT_JOB_STATUSES)}", name="status_allowed"),
        CheckConstraint("attempts >= 0", name="attempts_not_negative"),
        CheckConstraint("max_attempts > 0", name="max_attempts_positive"),
        CheckConstraint(
            f"failure_reason IS NULL OR length(failure_reason) <= {FAILURE_REASON_MAX_LENGTH}",
            name="failure_reason_length",
        ),
        # A `ready` job with no document is a lie the API would happily serve as
        # a 200 with an empty body. The database refuses to hold that state.
        CheckConstraint(
            "status <> 'ready' OR payload IS NOT NULL",
            name="ready_requires_payload",
        ),
        CheckConstraint(
            "payload IS NULL OR jsonb_typeof(payload) = 'object'",
            name="payload_is_object",
        ),
        Index("ix_export_jobs_user_id", "user_id"),
        # "The user's latest job" is the only read the profile screen makes.
        Index("ix_export_jobs_user_id_requested_at", "user_id", "requested_at"),
        # The queue's own index. Partial, because the table is mostly finished
        # jobs and the claim query only ever looks at pending ones — a full
        # index would grow without bound while the useful part stayed tiny.
        Index(
            "ix_export_jobs_pending_requested_at",
            "requested_at",
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True, default=uuid7)

    user_id: Mapped[UUID] = mapped_column(
        Uuid(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(Text(), nullable=False, server_default=text("'pending'"))

    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Incremented by the claim, not by the failure. A worker that is SIGKILLed
    # between claiming and failing never gets to write "that attempt failed", so
    # counting on the way in is the only count that survives a crash.
    attempts: Mapped[int] = mapped_column(Integer(), nullable=False, server_default=text("0"))
    max_attempts: Mapped[int] = mapped_column(
        Integer(), nullable=False, server_default=text(str(DEFAULT_MAX_ATTEMPTS))
    )

    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB(), nullable=True)

    failure_reason: Mapped[str | None] = mapped_column(Text(), nullable=True)

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_EXPORT_JOB_STATUSES

    @property
    def download_path(self) -> str | None:
        """Where the finished document can be fetched, or `None` until it can.

        A path rather than a full URL: the API does not know what hostname the
        browser reached it on, and guessing wrong is how a download link ends up
        pointing at `localhost` in production.
        """
        if self.status != "ready":
            return None
        return f"/privacy/export/{self.id}/download"

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<ExportJob id={self.id!s} status={self.status!r} attempts={self.attempts}>"
