"""Integration tests for the schema itself.

These span every module's models and belong to no single unit, so they live in
`tests/` rather than co-located. They need a real PostgreSQL: partial indexes,
CHECK constraints and triggers do not exist in SQLite, and asserting on them
against a fake would prove nothing about what production runs.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Connection, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from beff.core.email.model import EMAIL_DELIVERY_STATUSES
from beff.db.base import utcnow
from beff.db.registry import target_metadata
from beff.modules.auth.models import REVOKED_REASONS, USER_ROLES, RefreshToken, User
from beff.modules.metrics.models import PARAMETERS, PROCESS_STEPS
from beff.modules.onboarding.models import CELL_FORMATS, ONBOARDING_STEPS
from beff.modules.privacy.models import (
    CONSENT_PURPOSES,
    DSAR_KINDS,
    EXPORT_JOB_STATUSES,
    ConsentRecord,
)

pytestmark = pytest.mark.integration


def _make_user(email: str, *, deleted_at: datetime | None = None) -> User:
    return User(
        email=email,
        password_hash="$argon2id$v=19$m=65536,t=3,p=4$placeholder",
        display_name="Test Engineer",
        role="member",
        deleted_at=deleted_at,
    )


async def test_upgrade_head_then_downgrade_base_runs_clean(
    alembic_config: Config, db_engine: AsyncEngine
) -> None:
    """The verification ENG-27 is graded on.

    `db_engine` has already run `upgrade head`. Downgrading to base and back up
    proves the migration is reversible — which it only is because the metadata
    naming convention gives every index and constraint a name the downgrade can
    reference.
    """
    command.downgrade(alembic_config, "base")
    command.upgrade(alembic_config, "head")

    async with db_engine.connect() as connection:
        tables = await connection.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
        )
        # Pinned as an exact list rather than a subset check, so a table that
        # appears without anyone meaning it to — a leftover from a hand-edited
        # migration, a temp table never dropped — fails here. Adding a table is
        # supposed to be a two-line change to this list; that is the cost of
        # noticing an unplanned one.
        assert [row[0] for row in tables] == [
            "alembic_version",
            "batches",
            "consent_records",
            "dsar_requests",
            "email_deliveries",
            "email_verification_tokens",
            "export_jobs",
            "lines",
            "onboarding_progress",
            "plants",
            "process_measurements",
            "rate_limit_counters",
            "refresh_tokens",
            "scrap_events",
            "users",
            "waitlist_entries",
        ]


async def test_downgrade_base_leaves_no_application_tables(
    alembic_config: Config, db_engine: AsyncEngine
) -> None:
    command.downgrade(alembic_config, "base")

    async with db_engine.connect() as connection:
        remaining = await connection.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        )
        assert [row[0] for row in remaining] == ["alembic_version"]

        # The trigger's function is not attached to a table, so a downgrade that
        # only dropped tables would leave it orphaned.
        functions = await connection.execute(
            text("SELECT proname FROM pg_proc WHERE proname = 'consent_records_reject_update'")
        )
        assert functions.fetchall() == []

    command.upgrade(alembic_config, "head")


def _diff(connection: Connection) -> list[object]:
    context = MigrationContext.configure(connection)
    return list(compare_metadata(context, target_metadata))


async def test_migration_matches_the_models(db_engine: AsyncEngine) -> None:
    """A migrated database and `Base.metadata` must not have drifted.

    Without this, models and migrations diverge silently and the drift only
    surfaces the next time somebody runs `--autogenerate` and finds a diff they
    did not write.
    """
    async with db_engine.connect() as connection:
        differences = await connection.run_sync(_diff)

    assert differences == []


async def test_there_is_exactly_one_migration_head(alembic_config: Config) -> None:
    """Two heads mean two branches and `upgrade head` becomes ambiguous."""
    script = ScriptDirectory.from_config(alembic_config)

    assert len(script.get_heads()) == 1


# ─────────────────────────────────────────────────────────────────────────────
# The partial unique index — ENG-27's headline requirement.
# ─────────────────────────────────────────────────────────────────────────────


async def test_two_live_users_cannot_share_an_email(db_session: AsyncSession) -> None:
    db_session.add(_make_user("engineer@beff.example"))
    await db_session.commit()

    db_session.add(_make_user("engineer@beff.example"))

    with pytest.raises(IntegrityError):
        await db_session.commit()


async def test_a_purged_email_can_register_again(db_session: AsyncSession) -> None:
    """GDPR erasure must not lock the data subject out of ever returning.

    The index is `UNIQUE ... WHERE deleted_at IS NULL`, so a soft-deleted row
    stops participating in uniqueness the moment it is erased.
    """
    original = _make_user("engineer@beff.example")
    db_session.add(original)
    await db_session.commit()

    original.deleted_at = utcnow()
    await db_session.commit()

    replacement = _make_user("engineer@beff.example")
    db_session.add(replacement)
    await db_session.commit()

    assert replacement.id != original.id

    rows = await db_session.execute(
        text("SELECT count(*) FROM users WHERE email = 'engineer@beff.example'")
    )
    assert rows.scalar_one() == 2


async def test_many_erased_rows_may_share_one_email(db_session: AsyncSession) -> None:
    """Register, erase, register, erase — the index must tolerate repetition."""
    for _ in range(3):
        user = _make_user("serial@beff.example")
        db_session.add(user)
        await db_session.commit()
        user.deleted_at = utcnow()
        await db_session.commit()

    db_session.add(_make_user("serial@beff.example"))
    await db_session.commit()

    rows = await db_session.execute(
        text("SELECT count(*) FROM users WHERE email = 'serial@beff.example'")
    )
    assert rows.scalar_one() == 4


# ─────────────────────────────────────────────────────────────────────────────
# Database rules that are easy to get wrong and are enforced by review.
# ─────────────────────────────────────────────────────────────────────────────


async def test_every_timestamp_column_is_timestamptz(db_engine: AsyncEngine) -> None:
    """No bare `TIMESTAMP` anywhere, and no precision spec."""
    async with db_engine.connect() as connection:
        rows = await connection.execute(
            text(
                """
                SELECT table_name, column_name, data_type, datetime_precision
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND data_type LIKE 'timestamp%'
                """
            )
        )
        columns = rows.fetchall()

    assert columns, "expected the schema to have timestamp columns"
    naive = [(t, c) for t, c, kind, _ in columns if kind != "timestamp with time zone"]
    assert naive == []
    # PostgreSQL reports 6 for an unqualified TIMESTAMPTZ; anything lower means
    # somebody wrote a precision and is silently truncating.
    assert {precision for *_, precision in columns} == {6}


async def test_no_varchar_columns_exist(db_engine: AsyncEngine) -> None:
    """`TEXT` always; length limits belong in a CHECK where they are visible."""
    async with db_engine.connect() as connection:
        rows = await connection.execute(
            text(
                "SELECT table_name, column_name FROM information_schema.columns "
                "WHERE table_schema = 'public' AND data_type = 'character varying' "
                # Alembic's own bookkeeping table. Not ours to design.
                "AND table_name <> 'alembic_version'"
            )
        )

    assert rows.fetchall() == []


async def test_no_postgresql_enum_types_exist(db_engine: AsyncEngine) -> None:
    """Evolving business values are `TEXT + CHECK`; altering a PG enum is painful."""
    async with db_engine.connect() as connection:
        rows = await connection.execute(
            text(
                "SELECT typname FROM pg_type t "
                "JOIN pg_namespace n ON n.oid = t.typnamespace "
                "WHERE t.typtype = 'e' AND n.nspname = 'public'"
            )
        )

    assert rows.fetchall() == []


@pytest.mark.parametrize(
    ("table", "column", "allowed"),
    [
        ("consent_records", "purpose", CONSENT_PURPOSES),
        ("export_jobs", "status", EXPORT_JOB_STATUSES),
        ("onboarding_progress", "current_step", ONBOARDING_STEPS),
        ("lines", "cell_format", CELL_FORMATS),
        ("scrap_events", "process_step", PROCESS_STEPS),
        ("process_measurements", "parameter", PARAMETERS),
        # Added after an erasure shipped writing `account_erased` into a
        # column whose CHECK listed only `logout` and `reuse_detected`. The
        # gate below was already here and would have caught it on the day —
        # it simply was not pointed at this constraint, which is the other
        # way a gate fails. Every TEXT + CHECK column whose values live in a
        # Python constant is now listed.
        ("refresh_tokens", "revoked_reason", REVOKED_REASONS),
        ("users", "role", USER_ROLES),
        ("email_deliveries", "status", EMAIL_DELIVERY_STATUSES),
        ("dsar_requests", "kind", DSAR_KINDS),
    ],
)
async def test_each_check_constraint_accepts_exactly_the_values_the_code_uses(
    db_engine: AsyncEngine, table: str, column: str, allowed: tuple[str, ...]
) -> None:
    """The gap `compare_metadata` cannot see.

    Alembic's autogenerate compares whether a CHECK constraint *exists*, not what
    it says. So renaming a value in a Python constant and forgetting the
    migration leaves the models and the database disagreeing, every schema test
    passing, and the feature broken the moment it touches a real connection.

    That is not hypothetical: `product_analytics` and `marketing_email` became
    `analytics` and `marketing` in the code while `0001`'s constraint kept the
    old names, and every `POST /privacy/consent` failed with a constraint
    violation until `0002` renamed them. This test is what would have caught it
    on the day.
    """
    async with db_engine.connect() as connection:
        row = await connection.execute(
            text(
                "SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c "
                "JOIN pg_class t ON t.oid = c.conrelid "
                "WHERE t.relname = :table AND c.contype = 'c' "
                "AND pg_get_constraintdef(c.oid) LIKE '%' || :column || '%'"
            ),
            {"table": table, "column": column},
        )
        definitions = " ".join(str(r[0]) for r in row.fetchall())

    assert definitions, f"no CHECK constraint found on {table}.{column}"

    for value in allowed:
        assert f"'{value}'" in definitions, (
            f"{table}.{column} rejects {value!r}, which the application code uses"
        )


async def test_every_foreign_key_has_an_index(db_engine: AsyncEngine) -> None:
    """PostgreSQL indexes the referenced side, never the referencing side."""
    async with db_engine.connect() as connection:
        rows = await connection.execute(
            text(
                """
                SELECT c.conrelid::regclass::text AS table_name, c.conname
                FROM pg_constraint c
                WHERE c.contype = 'f'
                  AND c.connamespace = 'public'::regnamespace
                  AND NOT EXISTS (
                      SELECT 1
                      FROM pg_index i
                      WHERE i.indrelid = c.conrelid
                        -- An index only serves a foreign key if the key's
                        -- columns are its *leading* columns, hence the slice.
                        -- `indkey` is an int2vector, which has no array
                        -- operators, so it is round-tripped through text.
                        AND (string_to_array(i.indkey::text, ' ')::smallint[])[
                                1:cardinality(c.conkey)
                            ] = c.conkey
                  )
                """
            )
        )
        unindexed = rows.fetchall()

    assert unindexed == [], f"foreign keys without a leading index: {unindexed}"


# ─────────────────────────────────────────────────────────────────────────────
# Consent is append-only, enforced by the database.
# ─────────────────────────────────────────────────────────────────────────────


async def test_consent_records_reject_update(db_session: AsyncSession) -> None:
    """Art. 7(1) puts the burden of proof on the controller.

    Flipping a boolean would destroy the evidence that consent was ever given,
    so the trigger refuses. Withdrawal is a new row with `granted = false`.
    """
    user = _make_user("consenting@beff.example")
    db_session.add(user)
    await db_session.commit()

    record = ConsentRecord(
        user_id=user.id,
        purpose="analytics",
        granted=True,
        policy_version="2026-01-01",
        country_code="DE",
    )
    db_session.add(record)
    await db_session.commit()

    with pytest.raises(DBAPIError, match="append-only"):
        await db_session.execute(
            text("UPDATE consent_records SET granted = false WHERE id = :id"),
            {"id": record.id},
        )
    await db_session.rollback()


async def test_withdrawal_is_recorded_as_a_new_row(db_session: AsyncSession) -> None:
    user = _make_user("withdrawing@beff.example")
    db_session.add(user)
    await db_session.commit()

    db_session.add_all(
        [
            ConsentRecord(
                user_id=user.id,
                purpose="marketing",
                granted=True,
                policy_version="2026-01-01",
            ),
            ConsentRecord(
                user_id=user.id,
                purpose="marketing",
                granted=False,
                policy_version="2026-01-01",
            ),
        ]
    )
    await db_session.commit()

    rows = await db_session.execute(
        text("SELECT granted FROM consent_records WHERE user_id = :uid ORDER BY recorded_at, id"),
        {"uid": user.id},
    )
    assert [row[0] for row in rows] == [True, False]


async def test_a_raw_ip_cannot_be_stored_in_ip_hash(db_session: AsyncSession) -> None:
    """The CHECK pins the column to a 64-character hex digest.

    It is not a proof of hashing, but it does mean `192.0.2.1` cannot be dropped
    in by a careless caller.
    """
    user = _make_user("hashed@beff.example")
    db_session.add(user)
    await db_session.commit()

    db_session.add(
        ConsentRecord(
            user_id=user.id,
            purpose="privacy_policy",
            granted=True,
            policy_version="2026-01-01",
            ip_hash="192.0.2.1",
        )
    )

    with pytest.raises(IntegrityError, match="ip_hash_length"):
        await db_session.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Refresh tokens.
# ─────────────────────────────────────────────────────────────────────────────


async def test_refresh_token_cascades_when_its_user_is_erased(
    db_session: AsyncSession,
) -> None:
    """Erasure must not leave live sessions pointing at a deleted account."""
    user = _make_user("erasable@beff.example")
    db_session.add(user)
    await db_session.commit()

    issued = utcnow()
    db_session.add(
        RefreshToken(
            user_id=user.id,
            family_id=uuid4(),
            token_hash="a" * 64,
            issued_at=issued,
            expires_at=issued + timedelta(days=30),
        )
    )
    await db_session.commit()

    await db_session.execute(text("DELETE FROM users WHERE id = :id"), {"id": user.id})
    await db_session.commit()

    remaining = await db_session.execute(text("SELECT count(*) FROM refresh_tokens"))
    assert remaining.scalar_one() == 0


async def test_a_token_cannot_expire_before_it_is_issued(db_session: AsyncSession) -> None:
    user = _make_user("backwards@beff.example")
    db_session.add(user)
    await db_session.commit()

    now = datetime.now(UTC)
    db_session.add(
        RefreshToken(
            user_id=user.id,
            family_id=uuid4(),
            token_hash="b" * 64,
            issued_at=now,
            expires_at=now - timedelta(minutes=1),
        )
    )

    with pytest.raises(IntegrityError, match="expires_after_issue"):
        await db_session.commit()
