"""Metrics, export jobs, DSAR log and waitlist.

Everything the dashboard reads and everything the GDPR features write. Split
from `0001` rather than folded into it, because `0001` is already applied
wherever this has been run once, and editing an applied migration is how two
databases end up claiming the same revision with different schemas.

The DDL is transcribed verbatim from `CreateTable(...).compile()` against the
PostgreSQL dialect, so it cannot drift from the models by a typo. What actually
proves it is `tests/test_migrations.py`, which asserts `compare_metadata` finds
no difference after `upgrade head`.

Revision ID: 0002_metrics_privacy_waitlist
Revises: 0001_initial_schema
"""

from __future__ import annotations

from alembic import op

# The identifiers are the short form, matching `0001`. They are NOT the module
# name: pointing `down_revision` at "0001_initial_schema" builds a revision map
# with a dangling edge, and every alembic command then dies on a `KeyError`
# naming a revision that was never registered.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: None = None
depends_on: None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE waitlist_entries (
            id BIGINT GENERATED ALWAYS AS IDENTITY,
            email TEXT NOT NULL,
            company TEXT NOT NULL,
            policy_version TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            CONSTRAINT pk_waitlist_entries PRIMARY KEY (id),
            CONSTRAINT ck_waitlist_entries_email_length CHECK (length(email) <= 254),
            CONSTRAINT ck_waitlist_entries_email_not_blank CHECK (length(email) > 0),
            CONSTRAINT ck_waitlist_entries_company_length CHECK (length(company) <= 160),
            CONSTRAINT ck_waitlist_entries_company_not_blank CHECK (length(company) > 0),
            CONSTRAINT ck_waitlist_entries_policy_version_length CHECK (length(policy_version) <= 32),
            CONSTRAINT ck_waitlist_entries_policy_version_not_blank CHECK (length(policy_version) > 0)
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX uq_waitlist_entries_email ON waitlist_entries (email)")
    op.execute(
        """
        CREATE TABLE dsar_requests (
            id UUID NOT NULL,
            user_id UUID NOT NULL,
            kind TEXT NOT NULL,
            received_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            due_at TIMESTAMP WITH TIME ZONE NOT NULL,
            completed_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT pk_dsar_requests PRIMARY KEY (id),
            CONSTRAINT ck_dsar_requests_kind_allowed CHECK (kind IN ('access', 'erasure')),
            CONSTRAINT ck_dsar_requests_due_after_received CHECK (due_at > received_at),
            CONSTRAINT ck_dsar_requests_completed_after_received CHECK (completed_at IS NULL OR completed_at >= received_at),
            CONSTRAINT fk_dsar_requests_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """
    )
    op.execute("CREATE INDEX ix_dsar_requests_due_at ON dsar_requests (due_at)")
    op.execute("CREATE INDEX ix_dsar_requests_user_id ON dsar_requests (user_id)")
    op.execute(
        """
        CREATE TABLE export_jobs (
            id UUID NOT NULL,
            user_id UUID NOT NULL,
            status TEXT DEFAULT 'pending' NOT NULL,
            requested_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            attempts INTEGER DEFAULT 0 NOT NULL,
            max_attempts INTEGER DEFAULT 3 NOT NULL,
            payload JSONB,
            failure_reason TEXT,
            CONSTRAINT pk_export_jobs PRIMARY KEY (id),
            CONSTRAINT ck_export_jobs_status_allowed CHECK (status IN ('pending', 'running', 'ready', 'failed')),
            CONSTRAINT ck_export_jobs_attempts_not_negative CHECK (attempts >= 0),
            CONSTRAINT ck_export_jobs_max_attempts_positive CHECK (max_attempts > 0),
            CONSTRAINT ck_export_jobs_failure_reason_length CHECK (failure_reason IS NULL OR length(failure_reason) <= 500),
            CONSTRAINT ck_export_jobs_ready_requires_payload CHECK (status <> 'ready' OR payload IS NOT NULL),
            CONSTRAINT ck_export_jobs_payload_is_object CHECK (payload IS NULL OR jsonb_typeof(payload) = 'object'),
            CONSTRAINT fk_export_jobs_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_export_jobs_pending_requested_at ON export_jobs (requested_at) WHERE status = 'pending'"
    )
    op.execute("CREATE INDEX ix_export_jobs_user_id ON export_jobs (user_id)")
    op.execute(
        "CREATE INDEX ix_export_jobs_user_id_requested_at ON export_jobs (user_id, requested_at)"
    )
    op.execute(
        """
        CREATE TABLE batches (
            id BIGINT GENERATED ALWAYS AS IDENTITY,
            line_id BIGINT NOT NULL,
            code TEXT NOT NULL,
            started_at TIMESTAMP WITH TIME ZONE NOT NULL,
            cells_started BIGINT NOT NULL,
            cells_passed_eol BIGINT NOT NULL,
            capacity_retention_pct NUMERIC(5, 2) NOT NULL,
            co2_intensity_kg_per_kwh NUMERIC(6, 2) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            CONSTRAINT pk_batches PRIMARY KEY (id),
            CONSTRAINT ck_batches_code_length CHECK (length(code) <= 60),
            CONSTRAINT ck_batches_code_not_blank CHECK (length(code) > 0),
            CONSTRAINT ck_batches_cells_started_positive CHECK (cells_started > 0),
            CONSTRAINT ck_batches_cells_passed_within_started CHECK (cells_passed_eol >= 0 AND cells_passed_eol <= cells_started),
            CONSTRAINT ck_batches_capacity_retention_pct_range CHECK (capacity_retention_pct >= 0 AND capacity_retention_pct <= 100),
            CONSTRAINT ck_batches_co2_intensity_non_negative CHECK (co2_intensity_kg_per_kwh >= 0),
            CONSTRAINT fk_batches_line_id_lines FOREIGN KEY(line_id) REFERENCES lines (id) ON DELETE CASCADE
        )
        """
    )
    op.execute("CREATE INDEX ix_batches_line_id ON batches (line_id)")
    op.execute("CREATE INDEX ix_batches_line_id_started_at ON batches (line_id, started_at)")
    op.execute("CREATE UNIQUE INDEX uq_batches_line_id_code ON batches (line_id, code)")
    op.execute(
        """
        CREATE TABLE process_measurements (
            id BIGINT GENERATED ALWAYS AS IDENTITY,
            batch_id BIGINT NOT NULL,
            parameter TEXT NOT NULL,
            value NUMERIC(10, 3) NOT NULL,
            lower_limit NUMERIC(10, 3) NOT NULL,
            upper_limit NUMERIC(10, 3) NOT NULL,
            target_value NUMERIC(10, 3),
            unit TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            CONSTRAINT pk_process_measurements PRIMARY KEY (id),
            CONSTRAINT ck_process_measurements_parameter_allowed CHECK (parameter IN ('porosity_pct', 'areal_loading_mg_cm2', 'energy_density_wh_kg', 'coating_thickness_um')),
            CONSTRAINT ck_process_measurements_limits_ordered CHECK (lower_limit < upper_limit),
            CONSTRAINT ck_process_measurements_target_within_limits CHECK (target_value IS NULL OR (target_value >= lower_limit AND target_value <= upper_limit)),
            CONSTRAINT ck_process_measurements_unit_length CHECK (length(unit) <= 20),
            CONSTRAINT fk_process_measurements_batch_id_batches FOREIGN KEY(batch_id) REFERENCES batches (id) ON DELETE CASCADE
        )
        """
    )
    op.execute("CREATE INDEX ix_process_measurements_batch_id ON process_measurements (batch_id)")
    op.execute(
        "CREATE UNIQUE INDEX uq_process_measurements_batch_id_parameter ON process_measurements (batch_id, parameter)"
    )
    op.execute(
        """
        CREATE TABLE scrap_events (
            id BIGINT GENERATED ALWAYS AS IDENTITY,
            batch_id BIGINT NOT NULL,
            process_step TEXT NOT NULL,
            cells_scrapped BIGINT NOT NULL,
            committed_value_eur NUMERIC(12, 2) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            CONSTRAINT pk_scrap_events PRIMARY KEY (id),
            CONSTRAINT ck_scrap_events_process_step_allowed CHECK (process_step IN ('mixing', 'coating', 'drying', 'calendering', 'slitting', 'die_cutting', 'stacking', 'welding', 'filling', 'formation', 'aging', 'eol_test')),
            CONSTRAINT ck_scrap_events_cells_scrapped_non_negative CHECK (cells_scrapped >= 0),
            CONSTRAINT ck_scrap_events_committed_value_non_negative CHECK (committed_value_eur >= 0),
            CONSTRAINT fk_scrap_events_batch_id_batches FOREIGN KEY(batch_id) REFERENCES batches (id) ON DELETE CASCADE
        )
        """
    )
    op.execute("CREATE INDEX ix_scrap_events_batch_id ON scrap_events (batch_id)")
    op.execute(
        "CREATE UNIQUE INDEX uq_scrap_events_batch_id_step ON scrap_events (batch_id, process_step)"
    )


def downgrade() -> None:
    # Reverse dependency order, and no CASCADE. If something outside this
    # migration has taken a dependency on one of these tables, the downgrade
    # should fail loudly rather than silently taking it with them.
    op.execute("DROP TABLE scrap_events")
    op.execute("DROP TABLE process_measurements")
    op.execute("DROP TABLE batches")
    op.execute("DROP TABLE export_jobs")
    op.execute("DROP TABLE dsar_requests")
    op.execute("DROP TABLE waitlist_entries")
