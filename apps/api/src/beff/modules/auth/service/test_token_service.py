"""Unit tests for rotation and reuse detection.

Fast, against in-memory fakes, with an injected clock. There is an integration
test in `tests/test_auth_reuse_detection.py` that replays a used token over real
HTTP against real PostgreSQL; this file is where the state machine itself is
pinned down, case by case.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID, uuid4

import pytest

from beff.db.base import utcnow
from beff.modules.auth.errors import (
    RefreshTokenExpiredError,
    RefreshTokenInvalidError,
    RefreshTokenReusedError,
)
from beff.modules.auth.repository import InMemoryRefreshTokenRepository
from beff.modules.auth.service import RefreshTokenService

TTL_SECONDS = 60 * 60 * 24 * 30
GRACE_SECONDS = 10


class MovableClock:
    """A clock the test drives, so no wall-clock sleeping is needed."""

    def __init__(self, start: datetime | None = None) -> None:
        self.now = start or utcnow()

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **delta: float) -> None:
        self.now += timedelta(**delta)


@pytest.fixture
def clock() -> MovableClock:
    return MovableClock()


@pytest.fixture
def repository() -> InMemoryRefreshTokenRepository:
    return InMemoryRefreshTokenRepository()


@pytest.fixture
def service(repository: InMemoryRefreshTokenRepository, clock: MovableClock) -> RefreshTokenService:
    return RefreshTokenService(
        repository,
        ttl_seconds=TTL_SECONDS,
        grace_seconds=GRACE_SECONDS,
        clock=clock,
    )


@pytest.fixture
def user_id() -> UUID:
    return uuid4()


# ── Issuing ──────────────────────────────────────────────────────────────────


async def test_issuing_returns_a_plaintext_token_and_stores_only_its_hash(
    service: RefreshTokenService, user_id: UUID
) -> None:
    issued = await service.issue(user_id)

    assert issued.token
    assert issued.record.token_hash != issued.token
    assert len(issued.record.token_hash) == 64


async def test_each_login_starts_its_own_family(
    service: RefreshTokenService, user_id: UUID
) -> None:
    """Two devices must be independently revocable."""
    first = await service.issue(user_id)
    second = await service.issue(user_id)

    assert first.record.family_id != second.record.family_id


async def test_an_issued_token_expires_after_the_ttl(
    service: RefreshTokenService, user_id: UUID, clock: MovableClock
) -> None:
    issued = await service.issue(user_id)

    assert issued.record.expires_at == clock.now + timedelta(seconds=TTL_SECONDS)


# ── Rotation, the happy path ─────────────────────────────────────────────────


async def test_rotation_returns_a_different_token(
    service: RefreshTokenService, user_id: UUID
) -> None:
    first = await service.issue(user_id)

    second = await service.rotate(first.token)

    assert second.token != first.token


async def test_rotation_keeps_the_new_token_in_the_same_family(
    service: RefreshTokenService, user_id: UUID
) -> None:
    first = await service.issue(user_id)

    second = await service.rotate(first.token)

    assert second.record.family_id == first.record.family_id


async def test_rotation_spends_the_presented_token(
    service: RefreshTokenService, user_id: UUID, clock: MovableClock
) -> None:
    first = await service.issue(user_id)

    await service.rotate(first.token)

    assert first.record.used_at == clock.now


async def test_a_chain_of_rotations_stays_in_one_family(
    service: RefreshTokenService, repository: InMemoryRefreshTokenRepository, user_id: UUID
) -> None:
    current = await service.issue(user_id)
    family = current.record.family_id

    for _ in range(5):
        current = await service.rotate(current.token)

    assert len(await repository.list_family(family)) == 6


# ── Rejection ────────────────────────────────────────────────────────────────


async def test_an_unknown_token_is_rejected(service: RefreshTokenService) -> None:
    with pytest.raises(RefreshTokenInvalidError):
        await service.rotate("never-issued")


async def test_an_expired_token_is_rejected(
    service: RefreshTokenService, user_id: UUID, clock: MovableClock
) -> None:
    issued = await service.issue(user_id)
    clock.advance(seconds=TTL_SECONDS + 1)

    with pytest.raises(RefreshTokenExpiredError):
        await service.rotate(issued.token)


async def test_a_token_from_a_revoked_family_is_rejected(
    service: RefreshTokenService, user_id: UUID
) -> None:
    issued = await service.issue(user_id)
    await service.revoke_family_of(issued.token)

    with pytest.raises(RefreshTokenInvalidError):
        await service.rotate(issued.token)


# ── Reuse detection — the point of ENG-28 ────────────────────────────────────


async def test_replaying_a_spent_token_revokes_the_entire_family(
    service: RefreshTokenService,
    repository: InMemoryRefreshTokenRepository,
    user_id: UUID,
    clock: MovableClock,
) -> None:
    """The headline behaviour.

    A spent token reappearing means the chain forked, and a chain only forks if
    someone else has a copy. Revoking only the replayed token would leave the
    thief holding the newest one, so the whole family goes.
    """
    first = await service.issue(user_id)
    second = await service.rotate(first.token)
    third = await service.rotate(second.token)
    family = first.record.family_id

    clock.advance(seconds=GRACE_SECONDS + 1)

    with pytest.raises(RefreshTokenReusedError):
        await service.rotate(first.token)

    tokens = await repository.list_family(family)
    assert len(tokens) == 3
    assert all(token.revoked_at is not None for token in tokens)
    assert {token.revoked_reason for token in tokens} == {"reuse_detected"}
    # Most importantly: the token the thief did not present is dead too.
    assert third.record.revoked_at is not None


async def test_the_legitimate_client_is_locked_out_after_a_replay(
    service: RefreshTokenService, user_id: UUID, clock: MovableClock
) -> None:
    """The honest holder of the newest token loses the session as well.

    That is the intended trade: an attacker with a stolen token is
    indistinguishable from the real user, so the only safe move is to end the
    session for both and make them re-authenticate.
    """
    first = await service.issue(user_id)
    second = await service.rotate(first.token)
    clock.advance(seconds=GRACE_SECONDS + 1)

    with pytest.raises(RefreshTokenReusedError):
        await service.rotate(first.token)

    with pytest.raises(RefreshTokenReusedError):
        await service.rotate(second.token)


async def test_a_replay_after_revocation_still_reports_reuse(
    service: RefreshTokenService, user_id: UUID, clock: MovableClock
) -> None:
    """The client must be told to sign in, not to retry the refresh."""
    first = await service.issue(user_id)
    await service.rotate(first.token)
    clock.advance(seconds=GRACE_SECONDS + 1)

    with pytest.raises(RefreshTokenReusedError):
        await service.rotate(first.token)
    with pytest.raises(RefreshTokenReusedError):
        await service.rotate(first.token)


async def test_reuse_detection_does_not_touch_other_families(
    service: RefreshTokenService, user_id: UUID, clock: MovableClock
) -> None:
    """A compromise on one device must not sign the user out everywhere.

    If it did, users would learn that signing in on a second device breaks the
    first, which is a worse outcome than the attack being defended against.
    """
    laptop = await service.issue(user_id)
    phone = await service.issue(user_id)
    await service.rotate(laptop.token)
    clock.advance(seconds=GRACE_SECONDS + 1)

    with pytest.raises(RefreshTokenReusedError):
        await service.rotate(laptop.token)

    still_works = await service.rotate(phone.token)
    assert still_works.record.family_id == phone.record.family_id


# ── The grace window (ADR-0003's named false positive) ───────────────────────


async def test_two_tabs_racing_a_refresh_do_not_trip_reuse_detection(
    service: RefreshTokenService, user_id: UUID, clock: MovableClock
) -> None:
    """The failure ADR-0003 predicts if the window is absent.

    Both tabs hold the same cookie and both refresh on load. The second arrives
    milliseconds after the first has already spent the token.
    """
    issued = await service.issue(user_id)
    tab_one = await service.rotate(issued.token)

    clock.advance(seconds=1)
    tab_two = await service.rotate(issued.token)

    assert tab_two.token != tab_one.token
    assert tab_two.record.family_id == issued.record.family_id
    assert issued.record.revoked_at is None


async def test_a_replay_at_the_edge_of_the_window_is_still_forgiven(
    service: RefreshTokenService, user_id: UUID, clock: MovableClock
) -> None:
    issued = await service.issue(user_id)
    await service.rotate(issued.token)

    clock.advance(seconds=GRACE_SECONDS)

    assert (await service.rotate(issued.token)).token


async def test_one_second_past_the_window_is_treated_as_theft(
    service: RefreshTokenService, user_id: UUID, clock: MovableClock
) -> None:
    issued = await service.issue(user_id)
    await service.rotate(issued.token)

    clock.advance(seconds=GRACE_SECONDS + 1)

    with pytest.raises(RefreshTokenReusedError):
        await service.rotate(issued.token)


async def test_a_zero_grace_window_forgives_nothing(
    repository: InMemoryRefreshTokenRepository, clock: MovableClock, user_id: UUID
) -> None:
    """Deployments that would rather sign a user out than tolerate the risk."""
    strict = RefreshTokenService(repository, ttl_seconds=TTL_SECONDS, grace_seconds=0, clock=clock)
    issued = await strict.issue(user_id)
    await strict.rotate(issued.token)
    clock.advance(seconds=1)

    with pytest.raises(RefreshTokenReusedError):
        await strict.rotate(issued.token)


# ── Logout ───────────────────────────────────────────────────────────────────


async def test_logout_revokes_the_whole_family_not_just_one_token(
    service: RefreshTokenService,
    repository: InMemoryRefreshTokenRepository,
    user_id: UUID,
) -> None:
    """Otherwise "log out" would mean "log out of this tab"."""
    first = await service.issue(user_id)
    await service.rotate(first.token)

    revoked = await service.revoke_family_of(first.token)

    assert revoked == 2
    assert all(
        t.revoked_reason == "logout" for t in await repository.list_family(first.record.family_id)
    )


async def test_logging_out_with_an_unknown_token_is_not_an_error(
    service: RefreshTokenService,
) -> None:
    """A stale cookie should still end up logged out."""
    assert await service.revoke_family_of("never-issued") == 0


async def test_logging_out_twice_is_idempotent(service: RefreshTokenService, user_id: UUID) -> None:
    issued = await service.issue(user_id)

    assert await service.revoke_family_of(issued.token) == 1
    assert await service.revoke_family_of(issued.token) == 0
