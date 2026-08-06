"""Unit tests for registration, login, refresh, logout and bearer authentication."""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from argon2 import PasswordHasher

from beff.core.security import decode_access_token
from beff.db.base import utcnow
from beff.modules.auth.errors import (
    AccessTokenInvalidError,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    RefreshTokenInvalidError,
    RefreshTokenReusedError,
)
from beff.modules.auth.models import User
from beff.modules.auth.repository import (
    InMemoryRefreshTokenRepository,
    InMemoryUserRepository,
)
from beff.modules.auth.service import AuthenticatedSession, AuthService, RefreshTokenService

SECRET = "unit-test-secret-with-enough-entropy-to-satisfy-rfc-7518"
ALGORITHM = "HS256"
ACCESS_TTL = 900
GRACE_SECONDS = 10

PASSWORD = "correct horse battery staple"


class MovableClock:
    def __init__(self) -> None:
        self.now = utcnow()

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **delta: float) -> None:
        self.now += timedelta(**delta)


@pytest.fixture
def clock() -> MovableClock:
    return MovableClock()


@pytest.fixture
def users() -> InMemoryUserRepository:
    return InMemoryUserRepository()


@pytest.fixture
def tokens() -> InMemoryRefreshTokenRepository:
    return InMemoryRefreshTokenRepository()


@pytest.fixture
def service(
    users: InMemoryUserRepository,
    tokens: InMemoryRefreshTokenRepository,
    clock: MovableClock,
) -> AuthService:
    return AuthService(
        users,
        RefreshTokenService(
            tokens,
            ttl_seconds=60 * 60 * 24 * 30,
            grace_seconds=GRACE_SECONDS,
            clock=clock,
        ),
        jwt_secret=SECRET,
        jwt_algorithm=ALGORITHM,
        access_token_ttl_seconds=ACCESS_TTL,
        clock=clock,
    )


async def register(service: AuthService, email: str = "ada@beff.example") -> AuthenticatedSession:
    return await service.register(email=email, password=PASSWORD, display_name="Ada Lovelace")


# ── Registration ─────────────────────────────────────────────────────────────


async def test_registration_returns_a_usable_session(service: AuthService) -> None:
    session = await service.register(
        email="ada@beff.example", password=PASSWORD, display_name="Ada Lovelace"
    )

    assert session.access_token
    assert session.refresh_token
    assert session.expires_in == ACCESS_TTL
    assert session.user.email == "ada@beff.example"


async def test_registration_never_stores_the_plaintext_password(
    service: AuthService, users: InMemoryUserRepository
) -> None:
    await register(service)

    stored = users.users[0].password_hash
    assert PASSWORD not in stored
    assert stored.startswith("$argon2id$")


async def test_registration_folds_email_case_and_whitespace(
    service: AuthService, users: InMemoryUserRepository
) -> None:
    await service.register(email="  Ada@Beff.Example  ", password=PASSWORD, display_name="Ada")

    assert users.users[0].email == "ada@beff.example"


async def test_a_new_user_is_a_member_not_an_admin(
    service: AuthService, users: InMemoryUserRepository
) -> None:
    """Registration must not be a privilege-escalation path."""
    await register(service)

    assert users.users[0].role == "member"


async def test_registering_a_live_email_twice_is_a_conflict(service: AuthService) -> None:
    await register(service)

    with pytest.raises(EmailAlreadyRegisteredError):
        await register(service)


async def test_an_erased_account_frees_its_email(
    service: AuthService, users: InMemoryUserRepository
) -> None:
    """The service side of the partial unique index."""
    await register(service)
    users.users[0].deleted_at = utcnow()

    session = await register(service)

    assert session.user.deleted_at is None


# ── Login ────────────────────────────────────────────────────────────────────


async def test_login_with_the_right_password_starts_a_new_session(
    service: AuthService,
) -> None:
    await register(service)

    session = await service.login(email="ada@beff.example", password=PASSWORD)

    assert session.access_token


async def test_login_starts_a_family_separate_from_registration(
    service: AuthService, tokens: InMemoryRefreshTokenRepository
) -> None:
    """Signing in on a second device must not disturb the first."""
    await register(service)
    await service.login(email="ada@beff.example", password=PASSWORD)

    families = {token.family_id for token in tokens.tokens}
    assert len(families) == 2


async def test_login_with_the_wrong_password_is_rejected(service: AuthService) -> None:
    await register(service)

    with pytest.raises(InvalidCredentialsError):
        await service.login(email="ada@beff.example", password="not the password")


async def test_login_for_an_unknown_account_reports_the_same_error(
    service: AuthService,
) -> None:
    """Identical error for "no such user" and "wrong password" - anything else
    is an account-enumeration oracle."""
    await register(service)

    with pytest.raises(InvalidCredentialsError):
        await service.login(email="nobody@beff.example", password=PASSWORD)


async def test_login_is_case_insensitive_in_the_email(service: AuthService) -> None:
    await register(service)

    assert await service.login(email="ADA@BEFF.EXAMPLE", password=PASSWORD)


async def test_an_erased_account_cannot_sign_in(
    service: AuthService, users: InMemoryUserRepository
) -> None:
    """Erasure that leaves the account usable is not erasure."""
    await register(service)
    users.users[0].deleted_at = utcnow()

    with pytest.raises(InvalidCredentialsError):
        await service.login(email="ada@beff.example", password=PASSWORD)


async def test_a_password_hashed_at_an_older_cost_is_upgraded_on_login(
    service: AuthService, users: InMemoryUserRepository
) -> None:
    """A successful login is the only moment the plaintext exists, and therefore
    the only moment a raised cost factor can be applied without a password reset."""
    legacy = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)
    await users.add(
        User(
            id=uuid4(),
            email="grace@beff.example",
            password_hash=legacy.hash(PASSWORD),
            display_name="Grace Hopper",
            role="member",
        )
    )

    await service.login(email="grace@beff.example", password=PASSWORD)

    upgraded = users.users[0].password_hash
    assert "m=65536" in upgraded
    assert "t=3" in upgraded


async def test_a_password_already_at_current_cost_is_left_alone(
    service: AuthService, users: InMemoryUserRepository
) -> None:
    """Rehashing on every login would burn 50 ms for nothing and churn the row."""
    await register(service)
    before = users.users[0].password_hash

    await service.login(email="ada@beff.example", password=PASSWORD)

    assert users.users[0].password_hash == before


async def test_a_failed_login_never_rewrites_the_stored_hash(
    service: AuthService, users: InMemoryUserRepository
) -> None:
    """The upgrade must sit *after* verification, or a wrong password would
    overwrite the real one."""
    legacy = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)
    weak = legacy.hash(PASSWORD)
    await users.add(
        User(
            id=uuid4(),
            email="grace@beff.example",
            password_hash=weak,
            display_name="Grace Hopper",
            role="member",
        )
    )

    with pytest.raises(InvalidCredentialsError):
        await service.login(email="grace@beff.example", password="not the password")

    assert users.users[0].password_hash == weak


# ── Refresh ──────────────────────────────────────────────────────────────────


async def test_refresh_rotates_the_cookie_and_mints_a_new_access_token(
    service: AuthService,
) -> None:
    session = await register(service)

    refreshed = await service.refresh(session.refresh_token)

    assert refreshed.refresh_token != session.refresh_token
    assert refreshed.user.id == session.user.id


async def test_refresh_after_a_replay_raises_reuse(
    service: AuthService, clock: MovableClock
) -> None:
    session = await register(service)
    await service.refresh(session.refresh_token)
    clock.advance(seconds=GRACE_SECONDS + 1)

    with pytest.raises(RefreshTokenReusedError):
        await service.refresh(session.refresh_token)


async def test_refresh_fails_once_the_account_is_erased(
    service: AuthService, users: InMemoryUserRepository
) -> None:
    """A live refresh token must not outlive the account it belongs to."""
    session = await register(service)
    users.users[0].deleted_at = utcnow()

    with pytest.raises(RefreshTokenInvalidError):
        await service.refresh(session.refresh_token)


async def test_an_erased_users_new_token_is_revoked_rather_than_left_live(
    service: AuthService,
    users: InMemoryUserRepository,
    tokens: InMemoryRefreshTokenRepository,
) -> None:
    """Rotation has already issued a token by the time the user check fails."""
    session = await register(service)
    users.users[0].deleted_at = utcnow()

    with pytest.raises(RefreshTokenInvalidError):
        await service.refresh(session.refresh_token)

    assert all(token.revoked_at is not None for token in tokens.tokens)


# ── Logout ───────────────────────────────────────────────────────────────────


async def test_logout_ends_the_session(service: AuthService) -> None:
    session = await register(service)

    await service.logout(session.refresh_token)

    with pytest.raises(RefreshTokenInvalidError):
        await service.refresh(session.refresh_token)


async def test_logout_without_a_cookie_is_a_no_op(
    service: AuthService, tokens: InMemoryRefreshTokenRepository
) -> None:
    """Logging out twice, or with no session at all, must still leave you out.

    Asserting the return value is `None` would pass with the body deleted. What
    matters is that a live family belonging to *someone else* is not collateral
    damage of a stray logout.
    """
    other = await register(service, email="grace@beff.example")

    await service.logout(None)
    await service.logout("")

    # The other session survives - nothing was revoked by a logout with no token.
    refreshed = await service.refresh(other.refresh_token)
    assert refreshed.user.id == other.user.id
    assert all(record.revoked_at is None for record in tokens.tokens)


# ── Bearer authentication ────────────────────────────────────────────────────


async def test_a_fresh_access_token_resolves_to_its_user(service: AuthService) -> None:
    session = await register(service)

    user = await service.authenticate_access_token(session.access_token)

    assert user.id == session.user.id


async def test_the_access_token_carries_the_users_role(service: AuthService) -> None:
    session = await register(service)

    claims = decode_access_token(session.access_token, secret=SECRET, algorithm=ALGORITHM)

    assert claims.sub == session.user.id
    assert claims.role == "member"


async def test_a_garbage_bearer_token_is_rejected(service: AuthService) -> None:
    with pytest.raises(AccessTokenInvalidError):
        await service.authenticate_access_token("not.a.jwt")


async def test_a_token_signed_with_another_secret_is_rejected(
    users: InMemoryUserRepository, tokens: InMemoryRefreshTokenRepository, clock: MovableClock
) -> None:
    attacker = AuthService(
        users,
        RefreshTokenService(tokens, ttl_seconds=3600, grace_seconds=0, clock=clock),
        jwt_secret="a-forged-secret-that-is-also-long-enough-here",
        jwt_algorithm=ALGORITHM,
        access_token_ttl_seconds=ACCESS_TTL,
        clock=clock,
    )
    forged = await attacker.register(
        email="mallory@beff.example", password=PASSWORD, display_name="Mallory"
    )

    genuine = AuthService(
        users,
        RefreshTokenService(tokens, ttl_seconds=3600, grace_seconds=0, clock=clock),
        jwt_secret=SECRET,
        jwt_algorithm=ALGORITHM,
        access_token_ttl_seconds=ACCESS_TTL,
        clock=clock,
    )

    with pytest.raises(AccessTokenInvalidError):
        await genuine.authenticate_access_token(forged.access_token)


async def test_an_access_token_stops_working_once_the_account_is_erased(
    service: AuthService, users: InMemoryUserRepository
) -> None:
    """The reason the user is looked up rather than trusted from the claims."""
    session = await register(service)
    users.users[0].deleted_at = utcnow()

    with pytest.raises(AccessTokenInvalidError):
        await service.authenticate_access_token(session.access_token)
