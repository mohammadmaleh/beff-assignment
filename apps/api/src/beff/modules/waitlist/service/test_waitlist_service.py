"""Unit tests for the waitlist."""

from __future__ import annotations

import pytest

from beff.modules.waitlist.errors import AlreadyOnWaitlistError
from beff.modules.waitlist.models import WAITLIST_POLICY_VERSION
from beff.modules.waitlist.repository import InMemoryWaitlistRepository
from beff.modules.waitlist.service import WaitlistService


@pytest.fixture
def entries() -> InMemoryWaitlistRepository:
    return InMemoryWaitlistRepository()


@pytest.fixture
def service(entries: InMemoryWaitlistRepository) -> WaitlistService:
    return WaitlistService(entries)


async def test_joining_stores_the_entry(
    service: WaitlistService, entries: InMemoryWaitlistRepository
) -> None:
    await service.join(email="ada@beff.example", company="Beff GmbH")

    assert entries.entries[0].email == "ada@beff.example"
    assert entries.entries[0].company == "Beff GmbH"


async def test_the_policy_version_travels_with_the_row(
    service: WaitlistService, entries: InMemoryWaitlistRepository
) -> None:
    """The legal basis is consent, and consent to an unrecorded text proves
    nothing."""
    await service.join(email="ada@beff.example", company="Beff GmbH")

    assert entries.entries[0].policy_version == WAITLIST_POLICY_VERSION


async def test_email_case_and_whitespace_are_folded(
    service: WaitlistService, entries: InMemoryWaitlistRepository
) -> None:
    """The unique index compares raw bytes, so without folding `Ada@X` and
    `ada@x` are two entries for one person."""
    await service.join(email="  Ada@Beff.Example  ", company="Beff GmbH")

    assert entries.entries[0].email == "ada@beff.example"


async def test_signing_up_twice_is_a_conflict(service: WaitlistService) -> None:
    await service.join(email="ada@beff.example", company="Beff GmbH")

    with pytest.raises(AlreadyOnWaitlistError):
        await service.join(email="ada@beff.example", company="Beff GmbH")


async def test_the_duplicate_check_is_case_insensitive(service: WaitlistService) -> None:
    await service.join(email="ada@beff.example", company="Beff GmbH")

    with pytest.raises(AlreadyOnWaitlistError):
        await service.join(email="ADA@BEFF.EXAMPLE", company="Somewhere Else")


async def test_a_second_person_from_the_same_company_is_fine(
    service: WaitlistService, entries: InMemoryWaitlistRepository
) -> None:
    await service.join(email="ada@beff.example", company="Beff GmbH")
    await service.join(email="grace@beff.example", company="Beff GmbH")

    assert len(entries.entries) == 2
