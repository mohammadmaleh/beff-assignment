"""The auth SQL, against a real PostgreSQL.

`AuthService` and `TokenService` are unit-tested against `InMemory*` fakes, which
is right: the interesting mistakes there are rotation, reuse detection and the
grace window, and those are logic. The mistakes below are not logic — they are
things the database does that a dict does not:

- soft delete. Every "active" lookup carries `deleted_at IS NULL`, and a fake
  that pops the key on delete satisfies the test whether or not the predicate is
  in the query.
- the idempotent `UPDATE ... WHERE ... IS NULL` in `revoke_family` and
  `invalidate_outstanding`, whose whole contract is the row count PostgreSQL
  reports for a statement that matched fewer rows the second time.
- the unique index on `refresh_tokens.token_hash`, which is what makes "look up
  by hash" a lookup rather than a scan that happens to return one row today.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from beff.modules.auth.models import EmailVerificationToken, RefreshToken, User
from beff.modules.auth.repository import (
    PostgresEmailVerificationTokenRepository,
    PostgresRefreshTokenRepository,
    PostgresUserRepository,
)

pytestmark = pytest.mark.integration

NOW = datetime(2026, 7, 31, 12, 0, tzinfo=UTC)


def make_user(email: str = "member@beff.example") -> User:
    return User(
        email=email,
        password_hash="argon2-placeholder",
        display_name="Member",
        role="member",
    )


def token_hash(seed: str) -> str:
    """64 hex characters, which the CHECK constraint requires."""
    return seed[:1] * 64


# ─────────────────────────────────────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────────────────────────────────────


async def test_add_returns_the_row_the_database_filled_in(db_session: AsyncSession) -> None:
    """`add` flushes rather than commits — the transaction belongs to the request.

    The id and `created_at` have to be populated before the caller can build a
    response out of them, and both come from the database.
    """
    repository = PostgresUserRepository(db_session)

    user = await repository.add(make_user())

    assert user.id is not None
    assert user.created_at is not None
    assert user.deleted_at is None
    assert user.email_verified_at is None


async def test_an_erased_account_is_not_found_by_email_or_by_id(
    db_session: AsyncSession,
) -> None:
    """`deleted_at IS NULL` is in the query, not in the caller.

    This is the assertion a fake cannot make. An in-memory dict that deletes the
    key on erasure passes whether or not the predicate exists — and without the
    predicate, an erased account can still log in.
    """
    repository = PostgresUserRepository(db_session)
    user = await repository.add(make_user("erased@beff.example"))

    assert await repository.get_active_by_email("erased@beff.example") is not None
    assert await repository.get_active_by_id(user.id) is not None

    user.deleted_at = NOW
    await db_session.flush()

    assert await repository.get_active_by_email("erased@beff.example") is None
    assert await repository.get_active_by_id(user.id) is None


async def test_an_unknown_email_or_id_is_simply_absent(db_session: AsyncSession) -> None:
    repository = PostgresUserRepository(db_session)

    assert await repository.get_active_by_email("nobody@beff.example") is None
    assert await repository.get_active_by_id(uuid4()) is None


async def test_marking_the_email_verified_twice_keeps_the_first_moment(
    db_session: AsyncSession,
) -> None:
    """Following the link twice is normal — mail clients prefetch, people
    double-click — and the second visit must not rewrite when the address was
    confirmed."""
    repository = PostgresUserRepository(db_session)
    user = await repository.add(make_user())

    await repository.mark_email_verified(user, at=NOW)
    await repository.mark_email_verified(user, at=NOW + timedelta(hours=1))

    reread = (await db_session.execute(select(User).where(User.id == user.id))).scalar_one()
    assert reread.email_verified_at == NOW


# ─────────────────────────────────────────────────────────────────────────────
# Refresh tokens
# ─────────────────────────────────────────────────────────────────────────────


async def add_token(
    session: AsyncSession,
    user: User,
    *,
    family_id: object,
    seed: str,
    issued_at: datetime,
) -> RefreshToken:
    token = RefreshToken(
        user_id=user.id,
        family_id=family_id,
        token_hash=token_hash(seed),
        issued_at=issued_at,
        expires_at=issued_at + timedelta(days=30),
    )
    return await PostgresRefreshTokenRepository(session).add(token)


async def test_a_token_is_found_by_its_hash(db_session: AsyncSession) -> None:
    user = await PostgresUserRepository(db_session).add(make_user())
    repository = PostgresRefreshTokenRepository(db_session)
    await add_token(db_session, user, family_id=uuid4(), seed="a", issued_at=NOW)

    found = await repository.get_by_hash(token_hash("a"))

    assert found is not None
    assert found.user_id == user.id
    assert await repository.get_by_hash(token_hash("z")) is None


async def test_the_same_token_hash_cannot_be_stored_twice(db_session: AsyncSession) -> None:
    """The unique index is what makes `get_by_hash` a lookup.

    Without it a hash collision — or, far more likely, a rotation bug that
    re-inserts the same row — turns `scalar_one_or_none` into a
    `MultipleResultsFound` on a login path.
    """
    user = await PostgresUserRepository(db_session).add(make_user())
    await add_token(db_session, user, family_id=uuid4(), seed="a", issued_at=NOW)

    with pytest.raises(IntegrityError):
        await add_token(db_session, user, family_id=uuid4(), seed="a", issued_at=NOW)


async def test_marking_a_token_used_persists(db_session: AsyncSession) -> None:
    user = await PostgresUserRepository(db_session).add(make_user())
    repository = PostgresRefreshTokenRepository(db_session)
    token = await add_token(db_session, user, family_id=uuid4(), seed="a", issued_at=NOW)

    await repository.mark_used(token, at=NOW)

    found = await repository.get_by_hash(token_hash("a"))
    assert found is not None
    assert found.used_at == NOW


async def test_revoking_a_family_is_idempotent_and_reports_what_it_changed(
    db_session: AsyncSession,
) -> None:
    """`revoked_at IS NULL` in the predicate is the whole contract.

    A second replay arriving concurrently must revoke nothing and report zero,
    rather than overwriting the timestamp of the revocation that already
    happened — which is the record of *when* the theft was detected.
    """
    user = await PostgresUserRepository(db_session).add(make_user())
    repository = PostgresRefreshTokenRepository(db_session)
    family = uuid4()
    await add_token(db_session, user, family_id=family, seed="a", issued_at=NOW)
    await add_token(db_session, user, family_id=family, seed="b", issued_at=NOW)

    assert await repository.revoke_family(family, at=NOW, reason="reuse_detected") == 2
    assert await repository.revoke_family(family, at=NOW + timedelta(hours=1), reason="logout") == 0

    for row in await repository.list_family(family):
        assert row.revoked_at == NOW
        assert row.revoked_reason == "reuse_detected"


async def test_revoking_a_family_leaves_every_other_family_alone(
    db_session: AsyncSession,
) -> None:
    """A family is one login. Revoking the compromised one must not sign the
    person out of the laptop they are holding."""
    user = await PostgresUserRepository(db_session).add(make_user())
    repository = PostgresRefreshTokenRepository(db_session)
    compromised, healthy = uuid4(), uuid4()
    await add_token(db_session, user, family_id=compromised, seed="a", issued_at=NOW)
    await add_token(db_session, user, family_id=healthy, seed="b", issued_at=NOW)

    await repository.revoke_family(compromised, at=NOW, reason="reuse_detected")

    survivors = await repository.list_family(healthy)
    assert len(survivors) == 1
    assert survivors[0].revoked_at is None


async def test_a_family_is_listed_oldest_first(db_session: AsyncSession) -> None:
    """Ordered by `issued_at, id` so the chain reads as the rotation happened.

    An unordered result is a bug that only appears once the table is large
    enough to be scanned in a different order — by which time the thing being
    read is an incident timeline.
    """
    user = await PostgresUserRepository(db_session).add(make_user())
    repository = PostgresRefreshTokenRepository(db_session)
    family = uuid4()
    await add_token(db_session, user, family_id=family, seed="c", issued_at=NOW)
    await add_token(db_session, user, family_id=family, seed="a", issued_at=NOW - timedelta(days=2))
    await add_token(db_session, user, family_id=family, seed="b", issued_at=NOW - timedelta(days=1))

    listed = await repository.list_family(family)

    assert [row.token_hash for row in listed] == [
        token_hash("a"),
        token_hash("b"),
        token_hash("c"),
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Email verification tokens
# ─────────────────────────────────────────────────────────────────────────────


async def add_verification(
    session: AsyncSession, user: User, *, seed: str, issued_at: datetime = NOW
) -> EmailVerificationToken:
    return await PostgresEmailVerificationTokenRepository(session).add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=token_hash(seed),
            issued_at=issued_at,
            expires_at=issued_at + timedelta(hours=24),
        )
    )


async def test_a_verification_token_is_found_by_hash_and_consumed_once(
    db_session: AsyncSession,
) -> None:
    user = await PostgresUserRepository(db_session).add(make_user())
    repository = PostgresEmailVerificationTokenRepository(db_session)
    token = await add_verification(db_session, user, seed="a")

    await repository.consume(token, at=NOW)

    found = await repository.get_by_hash(token_hash("a"))
    assert found is not None
    assert found.consumed_at == NOW


async def test_resending_invalidates_every_live_token_and_counts_only_those(
    db_session: AsyncSession,
) -> None:
    """An old link must stop working the moment a new one is sent.

    `consumed_at IS NULL` in the predicate makes two resends racing safe: the
    second one overwrites nothing and honestly reports zero.
    """
    user = await PostgresUserRepository(db_session).add(make_user())
    repository = PostgresEmailVerificationTokenRepository(db_session)
    await add_verification(db_session, user, seed="a")
    await add_verification(db_session, user, seed="b")

    assert await repository.invalidate_outstanding(user.id, at=NOW) == 2
    assert await repository.invalidate_outstanding(user.id, at=NOW + timedelta(hours=1)) == 0

    spent = await repository.get_by_hash(token_hash("a"))
    assert spent is not None
    assert spent.consumed_at == NOW


async def test_invalidating_stops_at_the_account_it_was_asked_about(
    db_session: AsyncSession,
) -> None:
    users = PostgresUserRepository(db_session)
    user = await users.add(make_user())
    other = await users.add(make_user("other@beff.example"))
    repository = PostgresEmailVerificationTokenRepository(db_session)
    await add_verification(db_session, user, seed="a")
    await add_verification(db_session, other, seed="b")

    assert await repository.invalidate_outstanding(user.id, at=NOW) == 1

    untouched = await repository.get_by_hash(token_hash("b"))
    assert untouched is not None
    assert untouched.consumed_at is None


async def test_deleting_a_users_tokens_is_idempotent(db_session: AsyncSession) -> None:
    """Erasure runs this, and an at-least-once job may run it twice."""
    user = await PostgresUserRepository(db_session).add(make_user())
    repository = PostgresEmailVerificationTokenRepository(db_session)
    await add_verification(db_session, user, seed="a")

    assert await repository.delete_for_user(user.id) == 1
    assert await repository.delete_for_user(user.id) == 0
    assert await repository.get_by_hash(token_hash("a")) is None
