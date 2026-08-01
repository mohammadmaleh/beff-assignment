"""Rate limit counters.

A fixed-window counter table, so the one anonymous write in the API — the
waitlist form — is not an open door. Postgres rather than Redis for the reason
ADR-0006 already gives: the alternative actually on offer was no limiter at all,
not a better one.

Revision ID: 0003
Revises: 0002
"""

from __future__ import annotations

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: None = None
depends_on: None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE rate_limit_counters (
            id BIGSERIAL NOT NULL,
            bucket TEXT NOT NULL,
            key TEXT NOT NULL,
            window_start TIMESTAMP WITH TIME ZONE NOT NULL,
            count INTEGER NOT NULL,
            CONSTRAINT pk_rate_limit_counters PRIMARY KEY (id),
            CONSTRAINT ck_rate_limit_counters_count_positive CHECK (count > 0),
            CONSTRAINT ck_rate_limit_counters_bucket_length CHECK (length(bucket) <= 60),
            CONSTRAINT ck_rate_limit_counters_key_length CHECK (length(key) <= 200)
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_rate_limit_counters_window_start ON rate_limit_counters (window_start)"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_rate_limit_counters_bucket_key_window ON rate_limit_counters (bucket, key, window_start)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE rate_limit_counters")
