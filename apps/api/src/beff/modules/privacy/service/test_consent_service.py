"""Unit tests for append-only consent."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from beff.modules.privacy.errors import UnknownConsentPurposeError
from beff.modules.privacy.models import CURRENT_POLICY_VERSION
from beff.modules.privacy.repository import InMemoryConsentRepository
from beff.modules.privacy.service import ConsentService

USER = uuid4()
SALT = "unit-test-salt"
NOW = datetime(2026, 7, 31, 12, 0, tzinfo=UTC)


class Ticking:
    """Advances a second per call, so ordering is unambiguous."""

    def __init__(self) -> None:
        self.now = NOW

    def __call__(self) -> datetime:
        self.now += timedelta(seconds=1)
        return self.now


@pytest.fixture
def records() -> InMemoryConsentRepository:
    return InMemoryConsentRepository()


@pytest.fixture
def service(records: InMemoryConsentRepository) -> ConsentService:
    return ConsentService(records, ip_salt=SALT, clock=Ticking())


async def test_nothing_is_consented_to_by_default(service: ConsentService) -> None:
    """Consent is never assumed from silence — Art. 4(11) requires an
    unambiguous indication."""
    assert await service.state(USER) == {"analytics": False, "marketing": False}


async def test_granting_is_reflected_in_the_state(service: ConsentService) -> None:
    state = await service.record(USER, purpose="analytics", granted=True)

    assert state["analytics"] is True
    assert state["marketing"] is False


async def test_withdrawing_appends_rather_than_updating(
    service: ConsentService, records: InMemoryConsentRepository
) -> None:
    """**The core of the whole feature.**

    A boolean that flips leaves no evidence of what was agreed to before, and
    Art. 7(1) puts the burden of demonstrating consent on the controller. Both
    events must survive.
    """
    await service.record(USER, purpose="analytics", granted=True)
    await service.record(USER, purpose="analytics", granted=False)

    assert len(records.records) == 2
    assert [record.granted for record in records.records] == [True, False]
    assert (await service.state(USER))["analytics"] is False


async def test_the_history_survives_being_granted_again(
    service: ConsentService, records: InMemoryConsentRepository
) -> None:
    await service.record(USER, purpose="analytics", granted=True)
    await service.record(USER, purpose="analytics", granted=False)
    await service.record(USER, purpose="analytics", granted=True)

    assert len(records.records) == 3
    assert (await service.state(USER))["analytics"] is True


async def test_every_record_carries_the_policy_version(
    service: ConsentService, records: InMemoryConsentRepository
) -> None:
    """Without it the record proves nothing — the text it refers to has since
    changed."""
    await service.record(USER, purpose="marketing", granted=True)

    assert records.records[0].policy_version == CURRENT_POLICY_VERSION


async def test_purposes_are_independent(service: ConsentService) -> None:
    """Consent must be *specific*: one "I agree" cannot cover both."""
    await service.record(USER, purpose="analytics", granted=True)

    state = await service.state(USER)
    assert state["analytics"] is True
    assert state["marketing"] is False


async def test_an_unknown_purpose_is_refused(service: ConsentService) -> None:
    with pytest.raises(UnknownConsentPurposeError):
        await service.record(USER, purpose="sell_to_brokers", granted=True)


async def test_the_terms_of_service_purpose_is_not_client_manageable(
    service: ConsentService,
) -> None:
    """Withdrawing agreement to the terms is erasure, and that has its own
    endpoint. Exposing it here would let a client leave an account in a state
    with no lawful basis to exist."""
    with pytest.raises(UnknownConsentPurposeError):
        await service.record(USER, purpose="terms_of_service", granted=False)


async def test_the_ip_address_is_hashed_never_stored(
    service: ConsentService, records: InMemoryConsentRepository
) -> None:
    await service.record(
        USER, purpose="analytics", granted=True, ip_address="203.0.113.7", country_code="DE"
    )

    record = records.records[0]
    assert record.ip_hash is not None
    assert "203.0.113.7" not in record.ip_hash
    assert len(record.ip_hash) == 64


async def test_location_is_never_finer_than_a_country(
    service: ConsentService, records: InMemoryConsentRepository
) -> None:
    """City-level geolocation would be a new purpose needing its own basis."""
    await service.record(
        USER, purpose="analytics", granted=True, ip_address="203.0.113.7", country_code="de"
    )

    assert records.records[0].country_code == "DE"


async def test_an_absent_ip_is_recorded_as_absent(
    service: ConsentService, records: InMemoryConsentRepository
) -> None:
    await service.record(USER, purpose="analytics", granted=True)

    assert records.records[0].ip_hash is None
    assert records.records[0].country_code is None


async def test_two_users_do_not_share_consent(service: ConsentService) -> None:
    other = uuid4()
    await service.record(USER, purpose="analytics", granted=True)

    assert (await service.state(other))["analytics"] is False
