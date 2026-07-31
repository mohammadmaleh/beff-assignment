"""Unit tests for Art. 17 erasure."""

from __future__ import annotations

from uuid import uuid4

import pytest

from beff.modules.privacy.repository import InMemoryErasureRepository
from beff.modules.privacy.service import ErasureService

USER = uuid4()


@pytest.fixture
def repository() -> InMemoryErasureRepository:
    return InMemoryErasureRepository()


@pytest.fixture
def service(repository: InMemoryErasureRepository) -> ErasureService:
    return ErasureService(repository)


async def test_erasure_kills_every_session(
    service: ErasureService, repository: InMemoryErasureRepository
) -> None:
    """A live session outliving the account is the bug that makes everything
    else here pointless."""
    await service.erase(USER)

    assert repository.revoked == [USER]


async def test_erasure_deletes_the_exports(
    service: ErasureService, repository: InMemoryErasureRepository
) -> None:
    """An export is a complete copy of exactly what is being erased. Leaving one
    behind makes the erasure cosmetic."""
    await service.erase(USER)

    assert repository.exports_deleted == [USER]


async def test_consent_records_are_pseudonymised_not_deleted(
    service: ErasureService, repository: InMemoryErasureRepository
) -> None:
    """They are held on a different basis — Art. 6(1)(c), the accountability
    obligation in Art. 7(1) — so deleting them would destroy the proof that the
    processing which just ended was lawful."""
    await service.erase(USER)

    assert repository.consent_pseudonymised == [USER]


async def test_the_account_is_soft_deleted(
    service: ErasureService, repository: InMemoryErasureRepository
) -> None:
    """Soft, so the partial unique index frees the email for re-registration
    while the row's foreign keys stay intact."""
    await service.erase(USER)

    assert repository.soft_deleted == [USER]


async def test_sessions_die_before_the_account_row_is_touched(
    repository: InMemoryErasureRepository,
) -> None:
    """Order matters: a request already in flight must not be able to act on a
    half-erased account."""
    calls: list[str] = []

    class Ordered(InMemoryErasureRepository):
        async def revoke_all_token_families(self, user_id, *, at):  # type: ignore[no-untyped-def]
            calls.append("revoke")
            return await super().revoke_all_token_families(user_id, at=at)

        async def soft_delete_user(self, user_id, *, at):  # type: ignore[no-untyped-def]
            calls.append("soft_delete")
            await super().soft_delete_user(user_id, at=at)

    await ErasureService(Ordered()).erase(USER)

    assert calls.index("revoke") < calls.index("soft_delete")
