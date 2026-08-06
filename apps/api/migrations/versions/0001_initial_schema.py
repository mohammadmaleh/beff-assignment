"""initial schema

Users, refresh-token families, onboarding progress, plant/line setup and the
append-only consent log.

Generated with `--autogenerate` against the models, then edited by hand for the
two things autogenerate cannot express: the partial unique index that lets an
erased email re-register, and the trigger that makes `consent_records`
append-only in the database rather than only by convention.

Revision ID: 0001
Revises:
Create Date: 2026-07-31 17:48:05.831362+00:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# GDPR Art. 7(1) makes the controller prove consent was given. An `UPDATE` that
# flips `granted` from true to false destroys that proof, so the table rejects
# in-place mutation outright - withdrawal is a new row with `granted = false`.
#
# `DELETE` is deliberately still permitted: an Art. 17 erasure hard-deletes the
# user and cascades here. Removing a record is not the same as falsifying one,
# and blocking the cascade would make erasure impossible.
_APPEND_ONLY_FUNCTION = """
CREATE FUNCTION consent_records_reject_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'consent_records is append-only; record a new row instead of updating %',
        OLD.id
        USING ERRCODE = 'restrict_violation';
END;
$$;
"""

_APPEND_ONLY_TRIGGER = """
CREATE TRIGGER trg_consent_records_append_only
BEFORE UPDATE ON consent_records
FOR EACH ROW EXECUTE FUNCTION consent_records_reject_update();
"""


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), server_default=sa.text("'member'"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("role IN ('member', 'admin')", name=op.f("ck_users_role_allowed")),
        sa.CheckConstraint(
            "length(display_name) <= 120", name=op.f("ck_users_display_name_length")
        ),
        sa.CheckConstraint("length(email) <= 254", name=op.f("ck_users_email_length")),
        sa.CheckConstraint("length(email) > 0", name=op.f("ck_users_email_not_blank")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    # The whole point of ENG-27's verification: uniqueness applies only to live
    # rows, so erasing an account frees its address for re-registration. A plain
    # UNIQUE would keep the erased email hostage - itself a retention of
    # personal data the user asked to be rid of.
    op.create_index(
        "uq_users_email_active",
        "users",
        ["email"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_reason", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "revoked_reason IS NULL OR revoked_reason IN ('logout', 'reuse_detected')",
            name=op.f("ck_refresh_tokens_revoked_reason_allowed"),
        ),
        sa.CheckConstraint(
            "expires_at > issued_at", name=op.f("ck_refresh_tokens_expires_after_issue")
        ),
        sa.CheckConstraint(
            "length(token_hash) = 64", name=op.f("ck_refresh_tokens_token_hash_length")
        ),
        sa.CheckConstraint(
            "revoked_reason IS NULL OR revoked_at IS NOT NULL",
            name=op.f("ck_refresh_tokens_revoked_reason_requires_revoked_at"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_refresh_tokens_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_tokens")),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"], unique=False)
    # Reuse detection revokes a whole family in one statement; without this
    # index that is a sequential scan on the hottest table in the auth path.
    op.create_index("ix_refresh_tokens_family_id", "refresh_tokens", ["family_id"], unique=False)
    op.create_index("uq_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)

    op.create_table(
        "onboarding_progress",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("current_step", sa.Text(), server_default=sa.text("'role'"), nullable=False),
        sa.Column(
            "answers",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "current_step IN ('role', 'plant', 'lines', 'units', 'review')",
            name=op.f("ck_onboarding_progress_current_step_allowed"),
        ),
        sa.CheckConstraint(
            "jsonb_typeof(answers) = 'object'",
            name=op.f("ck_onboarding_progress_answers_is_object"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_onboarding_progress_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_onboarding_progress")),
    )
    # Unique, and therefore also the foreign key's index.
    op.create_index(
        "uq_onboarding_progress_user_id", "onboarding_progress", ["user_id"], unique=True
    )

    op.create_table(
        "plants",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("country_code", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "country_code ~ '^[A-Z]{2}$'", name=op.f("ck_plants_country_code_iso_alpha2")
        ),
        sa.CheckConstraint("length(name) <= 120", name=op.f("ck_plants_name_length")),
        sa.CheckConstraint("length(name) > 0", name=op.f("ck_plants_name_not_blank")),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_plants_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plants")),
    )
    op.create_index("ix_plants_user_id", "plants", ["user_id"], unique=False)
    op.create_index("uq_plants_user_id_name", "plants", ["user_id", "name"], unique=True)

    op.create_table(
        "lines",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("plant_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("cell_format", sa.Text(), nullable=False),
        sa.Column("is_pilot_line", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "cell_format IN ('pouch', 'prismatic', 'cylindrical')",
            name=op.f("ck_lines_cell_format_allowed"),
        ),
        sa.CheckConstraint("length(name) <= 120", name=op.f("ck_lines_name_length")),
        sa.CheckConstraint("length(name) > 0", name=op.f("ck_lines_name_not_blank")),
        sa.ForeignKeyConstraint(
            ["plant_id"], ["plants.id"], name=op.f("fk_lines_plant_id_plants"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lines")),
    )
    op.create_index("ix_lines_plant_id", "lines", ["plant_id"], unique=False)
    op.create_index("uq_lines_plant_id_name", "lines", ["plant_id", "name"], unique=True)

    op.create_table(
        "consent_records",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("granted", sa.Boolean(), nullable=False),
        sa.Column("policy_version", sa.Text(), nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("ip_hash", sa.Text(), nullable=True),
        sa.Column("country_code", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "country_code IS NULL OR country_code ~ '^[A-Z]{2}$'",
            name=op.f("ck_consent_records_country_code_iso_alpha2"),
        ),
        sa.CheckConstraint(
            "purpose IN ('terms_of_service', 'privacy_policy', 'product_analytics', "
            "'marketing_email')",
            name=op.f("ck_consent_records_purpose_allowed"),
        ),
        sa.CheckConstraint(
            "ip_hash IS NULL OR length(ip_hash) = 64",
            name=op.f("ck_consent_records_ip_hash_length"),
        ),
        sa.CheckConstraint(
            "length(policy_version) <= 32", name=op.f("ck_consent_records_policy_version_length")
        ),
        sa.CheckConstraint(
            "length(policy_version) > 0",
            name=op.f("ck_consent_records_policy_version_not_blank"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_consent_records_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_consent_records")),
    )
    op.create_index("ix_consent_records_user_id", "consent_records", ["user_id"], unique=False)
    op.create_index(
        "ix_consent_records_user_id_purpose_recorded_at",
        "consent_records",
        ["user_id", "purpose", "recorded_at"],
        unique=False,
    )

    op.execute(_APPEND_ONLY_FUNCTION)
    op.execute(_APPEND_ONLY_TRIGGER)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_consent_records_append_only ON consent_records")
    op.execute("DROP FUNCTION IF EXISTS consent_records_reject_update()")

    op.drop_index("ix_consent_records_user_id_purpose_recorded_at", table_name="consent_records")
    op.drop_index("ix_consent_records_user_id", table_name="consent_records")
    op.drop_table("consent_records")

    op.drop_index("uq_lines_plant_id_name", table_name="lines")
    op.drop_index("ix_lines_plant_id", table_name="lines")
    op.drop_table("lines")

    op.drop_index("uq_plants_user_id_name", table_name="plants")
    op.drop_index("ix_plants_user_id", table_name="plants")
    op.drop_table("plants")

    op.drop_index("uq_onboarding_progress_user_id", table_name="onboarding_progress")
    op.drop_table("onboarding_progress")

    op.drop_index("uq_refresh_tokens_token_hash", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_family_id", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.drop_index(
        "uq_users_email_active", table_name="users", postgresql_where=sa.text("deleted_at IS NULL")
    )
    op.drop_table("users")
