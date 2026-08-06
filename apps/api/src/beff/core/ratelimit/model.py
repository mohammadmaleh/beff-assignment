"""The `rate_limit_counters` table."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from beff.db.base import Base

__all__ = ["RateLimitCounter"]


class RateLimitCounter(Base):
    """One counter per (bucket, key, window).

    Not in a domain module: rate limiting is infrastructure that several modules
    will use, and putting the table under `modules/waitlist` would make the
    second caller import from the first.

    No `TimestampMixin`. `window_start` *is* the time dimension, and a
    `created_at` next to it would be a second timestamp meaning almost the same
    thing - the row is written once and incremented, never meaningfully updated.
    """

    __tablename__ = "rate_limit_counters"
    __table_args__ = (
        CheckConstraint("count > 0", name="count_positive"),
        CheckConstraint("length(bucket) <= 60", name="bucket_length"),
        CheckConstraint("length(key) <= 200", name="key_length"),
        # The composite primary key is what `ON CONFLICT` targets, so it is
        # load-bearing rather than incidental.
        Index(
            "uq_rate_limit_counters_bucket_key_window", "bucket", "key", "window_start", unique=True
        ),
        # Sweeping old windows is `DELETE ... WHERE window_start < now() - ...`,
        # which wants this rather than the composite above.
        Index("ix_rate_limit_counters_window_start", "window_start"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    bucket: Mapped[str] = mapped_column(Text(), nullable=False)

    # Never a raw IP. The caller hashes before it gets here - an IP is personal
    # data, and a rate-limit table is not a lawful basis for storing one.
    key: Mapped[str] = mapped_column(Text(), nullable=False)

    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    count: Mapped[int] = mapped_column(Integer(), nullable=False, default=1)
