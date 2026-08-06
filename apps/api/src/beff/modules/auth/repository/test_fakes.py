"""Unit tests for the in-memory repositories.

The fakes carry the whole unit suite, so they get tested too - an untested fake
is a place for a bug to hide behind a hundred passing service tests.
"""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest

from beff.db.base import utcnow
from beff.modules.auth.models import RefreshToken, User
from beff.modules.auth.repository import (
    InMemoryRefreshTokenRepository,
    InMemoryUserRepository,
    RefreshTokenRepository,
    UserRepository,
)


def make_user(email: str = "ada@beff.example") -> User:
    return User(
        id=uuid4(),
        email=email,
        password_hash="$argon2id$placeholder",
        display_name="Ada Lovelace",
        role="member",
    )


def make_token(family_id: object, token_hash: str) -> RefreshToken:
    issued = utcnow()
    return RefreshToken(
        user_id=uuid4(),
        family_id=family_id,
        token_hash=token_hash,
        issued_at=issued,
        expires_at=issued + timedelta(days=30),
    )


def test_the_fakes_satisfy_the_protocols() -> None:
    """Structural typing: no inheritance, checked by mypy and asserted here."""
    users: UserRepository = InMemoryUserRepository()
    tokens: RefreshTokenRepository = InMemoryRefreshTokenRepository()

    assert users is not None
    assert tokens is not None


async def test_a_user_can_be_found_by_email() -> None:
    repository = InMemoryUserRepository()
    user = await repository.add(make_user())

    assert await repository.get_active_by_email("ada@beff.example") is user


async def test_a_user_can_be_found_by_id() -> None:
    repository = InMemoryUserRepository()
    user = await repository.add(make_user())

    assert await repository.get_active_by_id(user.id) is user


async def test_a_soft_deleted_user_is_invisible_to_both_lookups() -> None:
    """Erasure has to actually stop the account working, not just mark it."""
    repository = InMemoryUserRepository()
    user = await repository.add(make_user())
    user.deleted_at = utcnow()

    assert await repository.get_active_by_email("ada@beff.example") is None
    assert await repository.get_active_by_id(user.id) is None


async def test_a_duplicate_live_email_is_rejected() -> None:
    """Mirrors `uq_users_email_active` so the fake is not laxer than production."""
    repository = InMemoryUserRepository()
    await repository.add(make_user())

    with pytest.raises(ValueError, match="duplicate live email"):
        await repository.add(make_user())


async def test_an_erased_email_can_be_registered_again() -> None:
    repository = InMemoryUserRepository()
    first = await repository.add(make_user())
    first.deleted_at = utcnow()

    second = await repository.add(make_user())

    assert second is not first


async def test_a_token_can_be_found_by_its_hash() -> None:
    repository = InMemoryRefreshTokenRepository()
    token = await repository.add(make_token(uuid4(), "a" * 64))

    assert await repository.get_by_hash("a" * 64) is token
    assert await repository.get_by_hash("b" * 64) is None


async def test_added_tokens_receive_increasing_ids() -> None:
    repository = InMemoryRefreshTokenRepository()

    first = await repository.add(make_token(uuid4(), "a" * 64))
    second = await repository.add(make_token(uuid4(), "b" * 64))

    assert second.id > first.id


async def test_marking_used_stamps_the_timestamp() -> None:
    repository = InMemoryRefreshTokenRepository()
    token = await repository.add(make_token(uuid4(), "a" * 64))
    at = utcnow()

    await repository.mark_used(token, at=at)

    assert token.used_at == at


async def test_revoking_a_family_hits_every_member() -> None:
    repository = InMemoryRefreshTokenRepository()
    family = uuid4()
    await repository.add(make_token(family, "a" * 64))
    await repository.add(make_token(family, "b" * 64))
    other = await repository.add(make_token(uuid4(), "c" * 64))

    revoked = await repository.revoke_family(family, at=utcnow(), reason="reuse_detected")

    assert revoked == 2
    assert all(t.revoked_at is not None for t in await repository.list_family(family))
    assert other.revoked_at is None


async def test_revoking_a_family_twice_is_idempotent() -> None:
    """A second concurrent replay must not overwrite the first revocation's time."""
    repository = InMemoryRefreshTokenRepository()
    family = uuid4()
    await repository.add(make_token(family, "a" * 64))
    first_at = utcnow()

    await repository.revoke_family(family, at=first_at, reason="reuse_detected")
    second = await repository.revoke_family(family, at=utcnow(), reason="logout")

    assert second == 0
    assert (await repository.list_family(family))[0].revoked_at == first_at
    assert (await repository.list_family(family))[0].revoked_reason == "reuse_detected"


async def test_a_family_lists_oldest_first() -> None:
    repository = InMemoryRefreshTokenRepository()
    family = uuid4()
    first = await repository.add(make_token(family, "a" * 64))
    second = await repository.add(make_token(family, "b" * 64))

    assert await repository.list_family(family) == [first, second]
