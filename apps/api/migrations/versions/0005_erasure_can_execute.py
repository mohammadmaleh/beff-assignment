"""Make Art. 17 erasure executable against a real database.

Two constraints stood in front of `DELETE /privacy/me`, and both were invisible
to a suite that unit-tests `ErasureService` against an in-memory fake. A fake has
no trigger and no CHECK, so the service's ordering was verified while the claim
that the ordering can be *executed* was never made at all. Both are fixed here;
`tests/test_privacy_repository.py` is the file that now makes that claim.

## 1. `refresh_tokens.revoked_reason`

`PostgresErasureRepository.revoke_all_token_families` writes `account_erased`,
which was in neither `REVOKED_REASONS` nor the CHECK constraint from 0001. That
is the *first* statement erasure issues, so the request died before it touched
anything else and rolled back whole.

The value is right and the constraint was wrong: an erasure is not a variant of
`logout` - nobody signed out - and keeping them distinct is what makes the
revocation trail answer "why" for a data subject request.

## 2. `consent_records`, the append-only trigger

The table has carried a `BEFORE UPDATE` trigger since 0001 that raises on every
update. That is the right default - Art. 7(1) puts the burden of proving consent
on the controller, and an `UPDATE` that flips `granted` destroys the evidence -
but it was one rule too blunt for the table to satisfy both of its obligations at
once.

Erasure keeps consent records (they are held on a different legal basis,
Art. 6(1)(c), and deleting them would destroy the proof that the processing which
just ended was lawful) and removes the ability to link them to a natural person:
the IP hash and the country code. That is an `UPDATE`, so the trigger refused it.

The fix is to say what is actually meant rather than to weaken the rule: exactly
one shape of update is permitted - `ip_hash` and `country_code` going to NULL
with every other column unchanged. Changing `granted`, `purpose`,
`policy_version`, `recorded_at` or `user_id` still raises, including in the same
statement that nulls the two identifiers.

Revision ID: 0005
Revises: 0004
"""

from __future__ import annotations

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: None = None
depends_on: None = None


# `IS NOT DISTINCT FROM` rather than `=` throughout: `recorded_at` and
# `policy_version` are NOT NULL, but comparing with `=` would evaluate to NULL -
# not false - for any nullable column, and a NULL condition takes the else
# branch. Writing the comparison the way that survives a future nullable column
# costs nothing today.
_ALLOW_PSEUDONYMISATION = """
CREATE OR REPLACE FUNCTION consent_records_reject_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    -- Art. 17 erasure: sever the link to a person, keep the evidence.
    IF NEW.id IS NOT DISTINCT FROM OLD.id
       AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
       AND NEW.purpose IS NOT DISTINCT FROM OLD.purpose
       AND NEW.granted IS NOT DISTINCT FROM OLD.granted
       AND NEW.policy_version IS NOT DISTINCT FROM OLD.policy_version
       AND NEW.recorded_at IS NOT DISTINCT FROM OLD.recorded_at
       AND NEW.ip_hash IS NULL
       AND NEW.country_code IS NULL
    THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION
        'consent_records is append-only; record a new row instead of updating %',
        OLD.id
        USING ERRCODE = 'restrict_violation';
END;
$$;
"""

_REJECT_EVERY_UPDATE = """
CREATE OR REPLACE FUNCTION consent_records_reject_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'consent_records is append-only; record a new row instead of updating %',
        OLD.id
        USING ERRCODE = 'restrict_violation';
END;
$$;
"""


_CONSTRAINT = "ck_refresh_tokens_revoked_reason_allowed"


def upgrade() -> None:
    op.execute(f"ALTER TABLE refresh_tokens DROP CONSTRAINT {_CONSTRAINT}")
    op.execute(
        f"ALTER TABLE refresh_tokens ADD CONSTRAINT {_CONSTRAINT} CHECK ("
        "revoked_reason IS NULL "
        "OR revoked_reason IN ('logout', 'reuse_detected', 'account_erased'))"
    )

    # `CREATE OR REPLACE` keeps the trigger itself in place - it references the
    # function by name, so replacing the body is enough and there is no window
    # in which the table is unguarded.
    op.execute(_ALLOW_PSEUDONYMISATION)


def downgrade() -> None:
    op.execute(_REJECT_EVERY_UPDATE)

    # Any row written while the widened constraint was in force would fail the
    # narrower one, so they are relabelled rather than left to break the
    # migration. `logout` is the closest surviving truth: the session ended and
    # was not reused.
    op.execute(
        "UPDATE refresh_tokens SET revoked_reason = 'logout' "
        "WHERE revoked_reason = 'account_erased'"
    )
    op.execute(f"ALTER TABLE refresh_tokens DROP CONSTRAINT {_CONSTRAINT}")
    op.execute(
        f"ALTER TABLE refresh_tokens ADD CONSTRAINT {_CONSTRAINT} CHECK ("
        "revoked_reason IS NULL OR revoked_reason IN ('logout', 'reuse_detected'))"
    )
