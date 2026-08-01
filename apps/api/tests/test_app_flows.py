"""Onboarding, metrics, privacy and waitlist over HTTP.

These cover what the unit suites cannot reach: status codes, the RFC 9457
envelope on each module's own errors, ownership scoping, and the fact that
every authenticated route actually rejects an anonymous caller.

They run against in-memory repositories rather than PostgreSQL, for the same
reason `test_auth_flow.py` does — persistence is covered by `test_migrations.py`,
and binding the fastest tests in the suite to Docker buys no extra signal.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from beff.main import create_app
from beff.modules.auth.dependencies import get_current_user
from beff.modules.auth.models import User
from beff.modules.metrics.dependencies import get_metrics_service
from beff.modules.metrics.repository import (
    BatchTotals,
    InMemoryMetricsRepository,
    ScrapTotals,
)
from beff.modules.metrics.service import MetricsService
from beff.modules.onboarding.dependencies import get_onboarding_service
from beff.modules.onboarding.models import Line
from beff.modules.onboarding.repository import (
    InMemoryOnboardingRepository,
    InMemorySetupRepository,
)
from beff.modules.onboarding.service import OnboardingService
from beff.modules.privacy.dependencies import (
    get_consent_service,
    get_erasure_service,
    get_export_service,
)
from beff.modules.privacy.repository import (
    InMemoryConsentRepository,
    InMemoryErasureRepository,
    InMemoryExportRepository,
)
from beff.modules.privacy.service import ConsentService, ErasureService, ExportService
from beff.modules.waitlist.dependencies import get_waitlist_service, waitlist_rate_limit
from beff.modules.waitlist.repository import InMemoryWaitlistRepository
from beff.modules.waitlist.service import WaitlistService

NOW = datetime(2026, 7, 31, 12, 0, tzinfo=UTC)
WINDOW = 30
CURRENT = (NOW - timedelta(days=WINDOW), NOW)

COMPLETE_ANSWERS = {
    "role": "process_engineer",
    "plant_name": "Werk Süd",
    "plant_country": "DE",
    "line_name": "Pilotlinie 1",
    "line_kind": "pilot",
    "cell_format": "pouch",
    "unit_system": "metric",
}


class Fixtures:
    """Every in-memory repository the app is wired to, reachable from a test."""

    def __init__(self) -> None:
        self.user = User(
            id=uuid4(),
            email="ada@beff.example",
            password_hash="",
            display_name="Ada Lovelace",
            role="member",
        )
        self.user.created_at = NOW
        self.user.updated_at = NOW

        self.progress = InMemoryOnboardingRepository()
        self.setup = InMemorySetupRepository()
        self.consent = InMemoryConsentRepository()
        self.exports = InMemoryExportRepository()
        self.erasure = InMemoryErasureRepository()
        self.waitlist = InMemoryWaitlistRepository()
        self.metrics = InMemoryMetricsRepository()


class Builder:
    """A stand-in export builder — the document's contents are tested elsewhere."""

    async def build(self, user_id: object) -> dict[str, object]:
        return {"subject": {"id": str(user_id)}}


@pytest.fixture
def fx() -> Fixtures:
    return Fixtures()


@pytest.fixture
async def api(fx: Fixtures) -> AsyncIterator[AsyncClient]:
    """The real app with only storage and the current user swapped."""
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: fx.user
    app.dependency_overrides[get_onboarding_service] = lambda: OnboardingService(
        fx.progress, fx.setup
    )
    app.dependency_overrides[get_metrics_service] = lambda: MetricsService(
        fx.metrics, clock=lambda: NOW
    )
    app.dependency_overrides[get_consent_service] = lambda: ConsentService(
        fx.consent, ip_salt="test-salt"
    )
    app.dependency_overrides[get_export_service] = lambda: ExportService(
        fx.exports, builder=Builder(), clock=lambda: NOW
    )
    app.dependency_overrides[get_erasure_service] = lambda: ErasureService(fx.erasure)
    app.dependency_overrides[get_waitlist_service] = lambda: WaitlistService(fx.waitlist)
    # The waitlist route carries a rate limiter that needs a real session. It is
    # covered against a live database in `test_rate_limit.py`, including that the
    # route enforces it; here it would only mean these tests silently start
    # 429ing once someone raises the parametrisation count.
    app.dependency_overrides[waitlist_rate_limit] = lambda: None

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def anon(fx: Fixtures) -> AsyncIterator[AsyncClient]:
    """No `get_current_user` override, so authentication is really enforced.

    Storage is still overridden — the point of this client is to reach the auth
    dependency, and a route that got past it would otherwise fail on a database
    connection instead of on the assertion, which reads as a pass for the wrong
    reason.
    """
    app = create_app()
    app.dependency_overrides[get_waitlist_service] = lambda: WaitlistService(fx.waitlist)
    app.dependency_overrides[waitlist_rate_limit] = lambda: None

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


# ── Authentication is actually required ──────────────────────────────────────


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/v1/onboarding"),
        ("PUT", "/api/v1/onboarding"),
        ("POST", "/api/v1/onboarding/complete"),
        ("GET", "/api/v1/metrics/overview"),
        ("GET", "/api/v1/privacy/consent"),
        ("POST", "/api/v1/privacy/consent"),
        ("GET", "/api/v1/privacy/export"),
        ("POST", "/api/v1/privacy/export"),
        ("DELETE", "/api/v1/privacy/erasure"),
    ],
)
async def test_every_private_route_rejects_an_anonymous_caller(
    anon: AsyncClient, method: str, path: str
) -> None:
    """The one test that would catch a route added without its dependency.

    A missing `CurrentUser` is invisible in a unit test — the service is called
    with whatever the test passes it — and it is the single highest-consequence
    mistake in the whole API.
    """
    response = await anon.request(method, path, json={})

    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/problem+json")


async def test_the_waitlist_is_deliberately_public(anon: AsyncClient) -> None:
    """It is the landing page's only endpoint, so it cannot require a session.
    That also makes it the app's one anonymous write — see the rate-limit note
    on the route."""
    response = await anon.post(
        "/api/v1/waitlist", json={"email": "ada@beff.example", "company": "Beff GmbH"}
    )

    assert response.status_code != 401


# ── Onboarding ───────────────────────────────────────────────────────────────


async def test_a_first_visit_returns_a_state_rather_than_404(api: AsyncClient) -> None:
    """ "Not started" is step `role` with no answers. A 404 would give the client
    two shapes to handle for one situation."""
    response = await api.get("/api/v1/onboarding")

    assert response.status_code == 200
    body = response.json()
    assert body["current_step"] == "role"
    assert body["answers"] == {}
    assert body["completed_at"] is None


async def test_the_server_sends_its_own_step_list(api: AsyncClient) -> None:
    """So adding a step is a backend change. A client with its own copy is a
    client that disagrees with the server about where the user is."""
    body = (await api.get("/api/v1/onboarding")).json()

    assert body["steps"] == ["role", "plant", "lines", "units", "review"]


async def test_saving_then_reloading_resumes_at_the_same_step(api: AsyncClient) -> None:
    """**The ENG-30 verification, over HTTP.**"""
    await api.put(
        "/api/v1/onboarding",
        json={"current_step": "lines", "answers": {"role": "quality_engineer"}},
    )

    resumed = (await api.get("/api/v1/onboarding")).json()

    assert resumed["current_step"] == "lines"
    assert resumed["answers"]["role"] == "quality_engineer"


async def test_the_server_names_what_is_still_missing(api: AsyncClient) -> None:
    """So the client can send the user back to the right step rather than
    showing a generic failure on the last screen of a wizard."""
    body = (
        await api.put(
            "/api/v1/onboarding",
            json={"current_step": "review", "answers": {"role": "process_engineer"}},
        )
    ).json()

    assert "plant_name" in body["missing"]


async def test_an_unknown_step_is_a_problem_document(api: AsyncClient) -> None:
    response = await api.put("/api/v1/onboarding", json={"current_step": "nope", "answers": {}})

    assert response.status_code == 422
    assert response.json()["code"] == "onboarding.unknown_step"


async def test_completing_creates_the_plant_and_line(api: AsyncClient, fx: Fixtures) -> None:
    await api.put(
        "/api/v1/onboarding", json={"current_step": "review", "answers": COMPLETE_ANSWERS}
    )

    response = await api.post("/api/v1/onboarding/complete")

    assert response.status_code == 200
    assert response.json()["completed_at"] is not None
    assert fx.setup.plants[0].name == "Werk Süd"
    assert fx.setup.lines[0].is_pilot_line is True


async def test_completing_twice_is_a_conflict(api: AsyncClient) -> None:
    await api.put(
        "/api/v1/onboarding", json={"current_step": "review", "answers": COMPLETE_ANSWERS}
    )
    await api.post("/api/v1/onboarding/complete")

    response = await api.post("/api/v1/onboarding/complete")

    assert response.status_code == 409
    assert response.json()["code"] == "onboarding.already_complete"


async def test_completing_early_names_the_missing_answers(api: AsyncClient) -> None:
    response = await api.post("/api/v1/onboarding/complete")

    assert response.status_code == 422
    problem = response.json()
    assert problem["code"] == "onboarding.incomplete"
    # Nested under `extra`, not spread across the top level: RFC 9457 §3.2
    # allows extension members, and keeping a type's own context in one named
    # object is what stops a future error inventing a key that collides with
    # `status` or `detail`.
    assert "plant_name" in problem["extra"]["missing"]


async def test_an_unknown_field_is_rejected_rather_than_ignored(api: AsyncClient) -> None:
    """`extra="forbid"`. Silently dropping a field the client thought it sent is
    how a wizard appears to save and does not."""
    response = await api.put(
        "/api/v1/onboarding",
        json={"current_step": "role", "answers": {}, "surprise": True},
    )

    assert response.status_code == 422


# ── Metrics ──────────────────────────────────────────────────────────────────


async def test_metrics_for_an_account_with_no_line_is_a_readable_error(
    api: AsyncClient,
) -> None:
    """Not an empty dashboard. Zeros would render as a line running 0% yield."""
    response = await api.get("/api/v1/metrics/overview")

    assert response.status_code == 422
    assert response.json()["code"] == "metrics.no_line_configured"


async def test_the_overview_returns_every_figure_in_one_round_trip(
    api: AsyncClient, fx: Fixtures
) -> None:
    line = Line(plant_id=1, name="Pilotlinie 1", cell_format="pouch", is_pilot_line=True)
    line.id = 1
    fx.metrics.line = line
    fx.metrics.totals = {
        CURRENT: BatchTotals(
            cells_started=1000,
            cells_passed=724,
            capacity_retention_pct=Decimal("88.20"),
            co2_intensity_kg_per_kwh=Decimal("61.50"),
        )
    }
    fx.metrics.scrap = {CURRENT: [ScrapTotals("formation", 40, Decimal("12000"))]}

    body = (await api.get("/api/v1/metrics/overview")).json()

    assert body["first_pass_yield_pct"] == 72.4
    assert body["line_kind"] == "pilot"
    assert body["scrap_by_step"][0]["process_step"] == "formation"
    assert body["capacity_retention_pct"] == 88.2


async def test_the_window_is_bounded(api: AsyncClient) -> None:
    """An unbounded `window_days` is an unbounded scan on a table that grows."""
    assert (await api.get("/api/v1/metrics/overview?window_days=0")).status_code == 422
    assert (await api.get("/api/v1/metrics/overview?window_days=400")).status_code == 422


# ── Consent ──────────────────────────────────────────────────────────────────


async def test_nothing_is_consented_to_by_default(api: AsyncClient) -> None:
    body = (await api.get("/api/v1/privacy/consent")).json()

    assert body == {"analytics": False, "marketing": False}


async def test_granting_and_withdrawing_both_append(api: AsyncClient, fx: Fixtures) -> None:
    """Withdrawal is the same endpoint with `granted: false` — Art. 7(3) wants it
    as easy as giving."""
    await api.post("/api/v1/privacy/consent", json={"purpose": "analytics", "granted": True})
    body = (
        await api.post("/api/v1/privacy/consent", json={"purpose": "analytics", "granted": False})
    ).json()

    assert body["analytics"] is False
    assert len(fx.consent.records) == 2
    assert [record.granted for record in fx.consent.records] == [True, False]


async def test_the_consent_endpoint_records_a_hashed_origin(api: AsyncClient, fx: Fixtures) -> None:
    """An IP is personal data. It reaches the row only as a salted hash."""
    await api.post(
        "/api/v1/privacy/consent",
        json={"purpose": "analytics", "granted": True},
        headers={"x-forwarded-for": "203.0.113.7, 198.51.100.1", "cf-ipcountry": "DE"},
    )

    record = fx.consent.records[0]
    assert record.ip_hash is not None
    assert "203.0.113.7" not in record.ip_hash
    assert record.country_code == "DE"


async def test_a_non_manageable_purpose_is_refused(api: AsyncClient) -> None:
    """Withdrawing agreement to the terms is erasure, and that has its own
    endpoint."""
    response = await api.post(
        "/api/v1/privacy/consent", json={"purpose": "terms_of_service", "granted": False}
    )

    assert response.status_code == 422
    assert response.json()["code"] == "privacy.unknown_consent_purpose"


# ── Export ───────────────────────────────────────────────────────────────────


async def test_no_export_yet_is_null_rather_than_404(api: AsyncClient) -> None:
    """A normal state of the profile screen, not an error."""
    response = await api.get("/api/v1/privacy/export")

    assert response.status_code == 200
    assert response.json() is None


async def test_requesting_an_export_is_accepted_and_idempotent(
    api: AsyncClient, fx: Fixtures
) -> None:
    first = await api.post("/api/v1/privacy/export")
    second = await api.post("/api/v1/privacy/export")

    assert first.status_code == 202
    assert first.json()["id"] == second.json()["id"]
    assert len(fx.exports.jobs) == 1


async def test_a_pending_export_has_no_download_path(api: AsyncClient) -> None:
    body = (await api.post("/api/v1/privacy/export")).json()

    assert body["status"] == "pending"
    assert body["download_path"] is None


async def test_downloading_an_unfinished_export_says_so(api: AsyncClient) -> None:
    job_id = (await api.post("/api/v1/privacy/export")).json()["id"]

    response = await api.get(f"/api/v1/privacy/export/{job_id}/download")

    assert response.status_code == 422
    assert response.json()["code"] == "privacy.export_not_ready"


async def test_someone_elses_export_is_not_found_rather_than_forbidden(
    api: AsyncClient,
) -> None:
    """403 would confirm the export exists to anyone who guessed an id."""
    response = await api.get(f"/api/v1/privacy/export/{uuid4()}/download")

    assert response.status_code == 404
    assert response.json()["code"] == "privacy.export_not_found"


# ── Erasure ──────────────────────────────────────────────────────────────────


async def test_erasure_returns_no_content_and_does_the_whole_sequence(
    api: AsyncClient, fx: Fixtures
) -> None:
    response = await api.delete("/api/v1/privacy/erasure")

    assert response.status_code == 204
    assert fx.erasure.revoked == [fx.user.id]
    assert fx.erasure.exports_deleted == [fx.user.id]
    assert fx.erasure.consent_pseudonymised == [fx.user.id]
    assert fx.erasure.soft_deleted == [fx.user.id]


# ── Waitlist ─────────────────────────────────────────────────────────────────


async def test_joining_the_waitlist_is_created(api: AsyncClient) -> None:
    response = await api.post(
        "/api/v1/waitlist", json={"email": "Ada@Beff.Example", "company": "Beff GmbH"}
    )

    assert response.status_code == 201
    # Echoed back folded, so the client can show which address it actually
    # stored rather than what was typed.
    assert response.json()["email"] == "ada@beff.example"


async def test_joining_twice_is_a_conflict_with_a_translatable_code(
    api: AsyncClient,
) -> None:
    payload = {"email": "ada@beff.example", "company": "Beff GmbH"}
    await api.post("/api/v1/waitlist", json=payload)

    response = await api.post("/api/v1/waitlist", json=payload)

    assert response.status_code == 409
    assert response.json()["code"] == "waitlist.already_registered"


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"email": "not-an-address", "company": "Beff GmbH"}, "email"),
        ({"email": "ada@beff.example", "company": ""}, "company"),
    ],
)
async def test_waitlist_validation_errors_name_the_field(
    api: AsyncClient, payload: dict[str, str], field: str
) -> None:
    """The landing form renders these inline against the right input, keyed by
    the field name."""
    response = await api.post("/api/v1/waitlist", json=payload)

    assert response.status_code == 422
    assert field in {error["field"] for error in response.json()["errors"]}
