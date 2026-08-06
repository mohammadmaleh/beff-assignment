"""Email verification, and the outbox that carries it.

Three changes: `users.email_verified_at`, a table of single-use verification
tokens, and a general-purpose delivery queue for outbound mail.

`email_verified_at` is nullable with no backfill, deliberately. Every account
that existed before this migration is unverified, because nobody ever asked its
owner to confirm anything — stamping them as verified would be recording a fact
that did not happen, and it is the one thing this column exists to know.

Revision ID: 0004
Revises: 0003
"""

from __future__ import annotations

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: None = None
depends_on: None = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP WITH TIME ZONE")

    op.execute(
        """
        CREATE TABLE email_verification_tokens (
            id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
            user_id UUID NOT NULL,
            token_hash TEXT NOT NULL,
            issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            consumed_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT pk_email_verification_tokens PRIMARY KEY (id),
            CONSTRAINT fk_email_verification_tokens_user_id_users
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            CONSTRAINT ck_email_verification_tokens_token_hash_length
                CHECK (length(token_hash) = 64),
            CONSTRAINT ck_email_verification_tokens_expires_after_issue
                CHECK (expires_at > issued_at)
        )
        """
    )
    # Every foreign key gets an index. PostgreSQL does not create one, and
    # without it the cascade on erasure is a sequential scan.
    op.execute(
        "CREATE INDEX ix_email_verification_tokens_user_id ON email_verification_tokens (user_id)"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_email_verification_tokens_token_hash "
        "ON email_verification_tokens (token_hash)"
    )
    # Partial: the table is mostly spent tokens, and "the live ones for this
    # user" is the only read that is not by hash.
    op.execute(
        "CREATE INDEX ix_email_verification_tokens_user_id_live "
        "ON email_verification_tokens (user_id) WHERE consumed_at IS NULL"
    )

    op.execute(
        """
        CREATE TABLE email_deliveries (
            id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
            user_id UUID,
            purpose TEXT NOT NULL,
            recipient TEXT NOT NULL,
            subject TEXT NOT NULL,
            body_text TEXT NOT NULL,
            body_html TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            attempts INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL DEFAULT 3,
            queued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            failure_reason TEXT,
            CONSTRAINT pk_email_deliveries PRIMARY KEY (id),
            CONSTRAINT fk_email_deliveries_user_id_users
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            CONSTRAINT ck_email_deliveries_status_allowed
                CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
            CONSTRAINT ck_email_deliveries_attempts_not_negative CHECK (attempts >= 0),
            CONSTRAINT ck_email_deliveries_max_attempts_positive CHECK (max_attempts > 0),
            CONSTRAINT ck_email_deliveries_recipient_length CHECK (length(recipient) <= 254),
            CONSTRAINT ck_email_deliveries_recipient_not_blank CHECK (length(recipient) > 0),
            CONSTRAINT ck_email_deliveries_subject_length CHECK (length(subject) <= 300),
            CONSTRAINT ck_email_deliveries_failure_reason_length
                CHECK (failure_reason IS NULL OR length(failure_reason) <= 500),
            CONSTRAINT ck_email_deliveries_sent_requires_completed_at
                CHECK (status <> 'sent' OR completed_at IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX ix_email_deliveries_user_id ON email_deliveries (user_id)")
    # The queue's own index. Partial, so it stays the size of the backlog rather
    # than the size of the history.
    op.execute(
        "CREATE INDEX ix_email_deliveries_pending_queued_at "
        "ON email_deliveries (queued_at) WHERE status = 'pending'"
    )


def downgrade() -> None:
    op.execute("DROP TABLE email_deliveries")
    op.execute("DROP TABLE email_verification_tokens")
    op.execute("ALTER TABLE users DROP COLUMN email_verified_at")
