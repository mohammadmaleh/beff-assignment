"""The privacy endpoints end to end: real router, real services, real PostgreSQL.

## Why this file exists, when both halves are already tested

`test_app_flows.py` drives these routes with `InMemory*` repositories overridden
in, which is the right way to test routing, status codes and the RFC 9457
envelope. `test_privacy_repository.py` drives the SQL directly. Between them
they cover both halves - and they left the *seam* uncovered, which is where the
two bugs migration `0005` fixes were sitting:

- `pseudonymise_consent` issues an `UPDATE consent_records`, which the
  append-only trigger rejects outright
- `revoke_all_token_families` wrote a `revoked_reason` that was not in the
  column's CHECK constraint

`test_erasure_returns_no_content_and_does_the_whole_sequence` passed throughout,
because a fake has neither a trigger nor a constraint. A user pressing "delete my
account" got a 500.

So this file overrides exactly one dependency - `get_session` - and lets every
other layer be the shipped one. Nothing here re-asserts what the two suites above
already prove; what it asserts is that the sequence can *run*.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from beff.core.config import get_settings
from beff.db import get_session
from beff.main import create_app
from beff.modules.auth.dependencies import (
    login_rate_limit,
    register_rate_limit,
)
from beff.modules.auth.models import RefreshToken, User
from beff.modules.privacy.models import ConsentRecord

pytestmark = pytest.mark.integration

EMAIL = "subject@beff.example"
PASSWORD = "a-long-enough-demo-password"


@pytest.fixture
async def api(db_session: AsyncSession, postgres_url: str) -> AsyncIterator[AsyncClient]:
    """The shipped app with only its session swapped.

    The rate limiters are overridden for the same reason `test_auth_flow.py`
    overrides them: they deliberately take an *independent* session and commit
    inside the check, so they would escape this test's transaction and leak
    counters between tests. They are covered for real in `test_rate_limit.py`.
    """
    get_settings.cache_clear()
    app = create_app()

    async def override_session() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[login_rate_limit] = lambda: None
    app.dependency_overrides[register_rate_limit] = lambda: None

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    get_settings.cache_clear()


async def register(api: AsyncClient) -> str:
    """Register through the real endpoint and return the access token."""
    response = await api.post(
        "/api/v1/auth/register",
        json={"email": EMAIL, "password": PASSWORD, "display_name": "Subject"},
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    assert isinstance(token, str)
    return token


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_registration_writes_a_real_row(api: AsyncClient, db_session: AsyncSession) -> None:
    """The precondition for everything below, asserted so a failure here is not
    read as a failure of the endpoint under test."""
    await register(api)

    user = (await db_session.execute(select(User).where(User.email == EMAIL))).scalar_one_or_none()
    assert user is not None
    assert user.deleted_at is None


async def test_recording_consent_appends_rather_than_updating(
    api: AsyncClient, db_session: AsyncSession
) -> None:
    """Withdrawal is a new row. The database enforces it, and the endpoint has
    to be written to agree - an `UPDATE` here would 500 on the trigger."""
    token = await register(api)

    granted = await api.post(
        "/api/v1/privacy/consent",
        json={"purpose": "analytics", "granted": True},
        headers=auth(token),
    )
    assert granted.status_code == 200, granted.text

    withdrawn = await api.post(
        "/api/v1/privacy/consent",
        json={"purpose": "analytics", "granted": False},
        headers=auth(token),
    )
    assert withdrawn.status_code == 200, withdrawn.text
    assert withdrawn.json()["analytics"] is False

    records = (
        (
            await db_session.execute(
                select(ConsentRecord).where(ConsentRecord.purpose == "analytics")
            )
        )
        .scalars()
        .all()
    )
    assert len(records) == 2, "the withdrawal is a second row, not an edit"


async def test_erasure_completes_against_a_real_database(
    api: AsyncClient, db_session: AsyncSession
) -> None:
    """**The test that would have caught both bugs in `0005`.**

    It asserts nothing about ordering - the service's unit test owns that - only
    that the request a data subject actually makes returns 204 rather than 500.
    Before the migration this failed twice over: on the append-only trigger, and
    before that on the `revoked_reason` CHECK.
    """
    token = await register(api)
    await api.post(
        "/api/v1/privacy/consent",
        json={"purpose": "analytics", "granted": True},
        headers=auth(token),
    )

    response = await api.delete("/api/v1/privacy/erasure", headers=auth(token))

    assert response.status_code == 204, response.text


async def test_after_erasure_the_account_is_gone_and_the_proof_is_not(
    api: AsyncClient, db_session: AsyncSession
) -> None:
    """Art. 17 and Art. 7(1) pulling in opposite directions, resolved.

    The account is unreachable and carries nothing identifying; the consent
    record survives, because it is the evidence that the processing which just
    ended was lawful - with the IP hash and country code stripped, which is what
    stops it identifying anyone.
    """
    token = await register(api)
    await api.post(
        "/api/v1/privacy/consent",
        json={"purpose": "analytics", "granted": True},
        headers=auth(token),
    )

    await api.delete("/api/v1/privacy/erasure", headers=auth(token))

    user = (await db_session.execute(select(User).where(User.email == EMAIL))).scalar_one_or_none()
    assert user is None, "the address no longer resolves to an account"

    consent = (await db_session.execute(select(ConsentRecord))).scalars().all()
    assert consent, "consent records are retained"
    assert all(record.ip_hash is None for record in consent)
    assert all(record.country_code is None for record in consent)

    tokens = (await db_session.execute(select(RefreshToken))).scalars().all()
    assert all(token_row.revoked_at is not None for token_row in tokens), (
        "a live session outliving the account is the bug that makes the rest pointless"
    )


async def test_the_erased_address_can_register_again(
    api: AsyncClient, db_session: AsyncSession
) -> None:
    """The partial unique index doing its job, through the real endpoint.

    Erasure is soft - the row's foreign keys have to stay intact - so the only
    thing that frees the address is `WHERE deleted_at IS NULL` on the index. A
    hard-coded uniqueness check anywhere above it would make erasure a
    permanent ban.
    """
    token = await register(api)
    await api.delete("/api/v1/privacy/erasure", headers=auth(token))

    again = await api.post(
        "/api/v1/auth/register",
        json={"email": EMAIL, "password": PASSWORD, "display_name": "Someone Else"},
    )

    assert again.status_code == 201, again.text


async def test_an_export_is_queued_and_readable_through_the_api(
    api: AsyncClient, db_session: AsyncSession
) -> None:
    """Art. 15/20, up to the point the worker takes over.

    The job is `pending` on the way out, because building it is the worker's
    work - asserting `ready` here would be asserting that the API does the
    thing it deliberately does not do.
    """
    token = await register(api)

    requested = await api.post("/api/v1/privacy/export", headers=auth(token))
    assert requested.status_code in (200, 201, 202), requested.text
    job_id = requested.json()["id"]

    # Idempotent: a double-click, or a browser retrying the POST, must not
    # queue a second build of the same document.
    again = await api.post("/api/v1/privacy/export", headers=auth(token))
    assert again.json()["id"] == job_id

    # `GET /export` answers with the latest job for the caller - there is no
    # by-id status route, because a data subject has at most one export in
    # flight and asking for "mine" cannot be pointed at somebody else's.
    latest = await api.get("/api/v1/privacy/export", headers=auth(token))
    assert latest.status_code == 200, latest.text
    assert latest.json()["id"] == job_id
    assert latest.json()["status"] == "pending"


async def test_an_unfinished_export_cannot_be_downloaded(api: AsyncClient) -> None:
    """The document does not exist yet, and saying so is the honest answer.

    Handing back an empty body with a 200 would be indistinguishable, to the
    browser doing the download, from an export containing nothing.
    """
    token = await register(api)
    requested = await api.post("/api/v1/privacy/export", headers=auth(token))
    job_id = requested.json()["id"]

    download = await api.get(f"/api/v1/privacy/export/{job_id}/download", headers=auth(token))

    assert download.status_code == 422, download.text
    body = download.json()
    # `code` is the translation key, and `extra.status` is what lets the client
    # say "still building" rather than "something went wrong".
    assert body["code"] == "privacy.export_not_ready"
    assert body["extra"]["status"] == "pending"
