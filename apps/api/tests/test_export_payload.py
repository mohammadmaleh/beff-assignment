"""What an Art. 15 / Art. 20 export actually contains, built by real SQL.

`PostgresExportBuilder` is six queries and a dictionary literal, and the only
instrument that can check either half is a real database holding a real subject's
rows. A fake builder — which is what `test_export_service.py` uses, correctly —
returns whatever the test author typed, so it can prove the queue retries and
cannot prove the document is right.

Two of the assertions here are the whole reason the module has a docstring:

- **No password hash.** It is a credential, not personal data the subject needs,
  and shipping one turns a portability request into an offline cracking target.
- **No third party's data.** Art. 15(4) says the right to a copy must not
  adversely affect the rights of others, so another account's plants, lines and
  consent records must not appear because a `WHERE` clause was forgotten.

Both are asserted against a database holding a *second* user, because a filter
that is missing and a filter that is right look identical when there is only one
row in the table.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from beff.core.email.model import EmailDelivery
from beff.modules.auth.models import User
from beff.modules.onboarding.models import Line, OnboardingProgress, Plant
from beff.modules.privacy.models import ConsentRecord
from beff.modules.privacy.service import PermanentExportError
from beff.modules.privacy.service.payload_builder import (
    EXPORT_FORMAT_VERSION,
    PostgresExportBuilder,
)

pytestmark = pytest.mark.integration

NOW = datetime(2026, 7, 31, 12, 0, tzinfo=UTC)

SECRET_HASH = "$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHQ$notarealhashbutlooksit"


async def populate(session: AsyncSession, *, email: str, plant_name: str) -> User:
    """One fully furnished data subject."""
    user = User(
        email=email,
        password_hash=SECRET_HASH,
        display_name="Dana Vogel",
        role="member",
        email_verified_at=NOW - timedelta(days=10),
    )
    session.add(user)
    await session.flush()

    session.add(
        ConsentRecord(
            user_id=user.id,
            purpose="analytics",
            granted=True,
            policy_version="2026-01-01",
            recorded_at=NOW - timedelta(days=5),
            ip_hash="f" * 64,
            country_code="DE",
        )
    )
    session.add(
        EmailDelivery(
            user_id=user.id,
            purpose="email_verification",
            recipient=email,
            subject="Bestätige deine E-Mail-Adresse",
            body_text="Hier ist dein Link: https://example.invalid/verify?token=secret",
            status="sent",
            queued_at=NOW - timedelta(days=10),
            completed_at=NOW - timedelta(days=10),
        )
    )
    session.add(
        OnboardingProgress(
            user_id=user.id,
            current_step="review",
            answers={"role": "process_engineer", "units": "metric"},
            completed_at=NOW - timedelta(days=9),
        )
    )
    plant = Plant(user_id=user.id, name=plant_name, country_code="DE")
    session.add(plant)
    await session.flush()
    session.add(
        Line(plant_id=plant.id, name="Pilotlinie 1", cell_format="pouch", is_pilot_line=True)
    )
    await session.flush()
    return user


async def test_the_export_describes_itself_and_the_subject(db_session: AsyncSession) -> None:
    user = await populate(db_session, email="dana@beff.example", plant_name="Werk Süd")

    payload = await PostgresExportBuilder(db_session).build(user.id)

    assert payload["format_version"] == EXPORT_FORMAT_VERSION
    assert payload["generated_at"]
    assert payload["subject"] == {
        "id": str(user.id),
        "email": "dana@beff.example",
        "display_name": "Dana Vogel",
        "role": "member",
        "created_at": payload["subject"]["created_at"],
        "email_verified_at": (NOW - timedelta(days=10)).isoformat(),
    }


async def test_the_password_hash_is_nowhere_in_the_document(db_session: AsyncSession) -> None:
    """Asserted against the serialised bytes, not against one key.

    Checking `"password_hash" not in payload["subject"]` only rules out the
    place somebody already thought of. The hash could arrive nested under
    `onboarding.answers` or in a future section, so the check is that the value
    does not appear in the document at all.
    """
    user = await populate(db_session, email="dana@beff.example", plant_name="Werk Süd")

    payload = await PostgresExportBuilder(db_session).build(user.id)

    assert SECRET_HASH not in json.dumps(payload)
    assert "password_hash" not in json.dumps(payload)


async def test_the_export_carries_the_subjects_own_records(db_session: AsyncSession) -> None:
    user = await populate(db_session, email="dana@beff.example", plant_name="Werk Süd")

    payload = await PostgresExportBuilder(db_session).build(user.id)

    assert payload["consent_records"] == [
        {
            "purpose": "analytics",
            "granted": True,
            "policy_version": "2026-01-01",
            "recorded_at": (NOW - timedelta(days=5)).isoformat(),
            "country_code": "DE",
        }
    ]
    assert payload["onboarding"] == {
        "current_step": "review",
        "answers": {"role": "process_engineer", "units": "metric"},
        "completed_at": (NOW - timedelta(days=9)).isoformat(),
    }
    assert payload["plants"] == [{"name": "Werk Süd", "country_code": "DE"}]
    assert payload["lines"] == [
        {"name": "Pilotlinie 1", "cell_format": "pouch", "is_pilot_line": True}
    ]


async def test_the_ip_hash_is_not_exported(db_session: AsyncSession) -> None:
    """It is a pseudonym held for accountability, not information about the
    subject — and it cannot be reversed for them anyway."""
    user = await populate(db_session, email="dana@beff.example", plant_name="Werk Süd")

    payload = await PostgresExportBuilder(db_session).build(user.id)

    assert "f" * 64 not in json.dumps(payload)


async def test_email_deliveries_report_what_was_sent_but_not_the_body(
    db_session: AsyncSession,
) -> None:
    """Subject and status answer "did you email me and did it work".

    The body is excluded deliberately: a verification body contains a link that,
    while spent, is still a credential shape, and nobody needs it re-published
    into a file the subject will download over whatever connection they have.
    """
    user = await populate(db_session, email="dana@beff.example", plant_name="Werk Süd")

    payload = await PostgresExportBuilder(db_session).build(user.id)

    assert payload["email_deliveries"] == [
        {
            "purpose": "email_verification",
            "subject": "Bestätige deine E-Mail-Adresse",
            "status": "sent",
            "queued_at": (NOW - timedelta(days=10)).isoformat(),
            "completed_at": (NOW - timedelta(days=10)).isoformat(),
        }
    ]
    assert "token=secret" not in json.dumps(payload)


async def test_no_other_subjects_data_reaches_the_document(db_session: AsyncSession) -> None:
    """Art. 15(4). Every section is filtered, including the one that joins.

    `lines` has no `user_id` of its own — it reaches the subject through
    `plants` — so it is the section where a missing filter is easiest to write
    and hardest to notice.
    """
    user = await populate(db_session, email="dana@beff.example", plant_name="Werk Süd")
    await populate(db_session, email="stranger@beff.example", plant_name="Fremdes Werk")

    payload = await PostgresExportBuilder(db_session).build(user.id)

    serialised = json.dumps(payload)
    assert "stranger@beff.example" not in serialised
    assert "Fremdes Werk" not in serialised
    assert len(payload["plants"]) == 1
    assert len(payload["lines"]) == 1
    assert len(payload["consent_records"]) == 1
    assert len(payload["email_deliveries"]) == 1


async def test_a_sparse_account_still_produces_a_well_formed_document(
    db_session: AsyncSession,
) -> None:
    """Somebody who registered and did nothing else still gets an export.

    Empty lists and a null `onboarding`, not a missing key: a recipient system
    reading the document should not have to distinguish "no plants" from "this
    export does not cover plants".
    """
    user = User(email="quiet@beff.example", password_hash="x", display_name="Q", role="member")
    db_session.add(user)
    await db_session.flush()

    payload = await PostgresExportBuilder(db_session).build(user.id)

    assert payload["onboarding"] is None
    assert payload["plants"] == []
    assert payload["lines"] == []
    assert payload["consent_records"] == []
    assert payload["email_deliveries"] == []
    assert payload["subject"]["email_verified_at"] is None


async def test_building_for_a_missing_user_is_a_permanent_failure(
    db_session: AsyncSession,
) -> None:
    """Not retryable: the account is gone, and no number of attempts brings it
    back. Retrying would burn the budget and delay the dead-letter path."""
    from uuid import uuid4

    with pytest.raises(PermanentExportError):
        await PostgresExportBuilder(db_session).build(uuid4())


async def test_the_whole_document_survives_json_serialisation(
    db_session: AsyncSession,
) -> None:
    """It is stored in a JSONB column and downloaded as a file.

    A `datetime` or a `UUID` that escapes `_json_safe` raises at the moment the
    job is written back, which is inside a worker, on a retry path, at 3am.
    """
    user = await populate(db_session, email="dana@beff.example", plant_name="Werk Süd")

    payload = await PostgresExportBuilder(db_session).build(user.id)

    assert json.loads(json.dumps(payload)) == payload
