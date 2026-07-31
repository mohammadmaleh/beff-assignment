"""In-memory repositories for fast unit tests.

These ship in `src/` rather than in a test tree on purpose. They are part of the
module's contract — the thing that makes `AuthService` testable without a
database — and mypy checks them against the same `Protocol` as the PostgreSQL
implementations, so a change to the protocol cannot leave the fakes behind.

They are honest about the constraints the database enforces: the partial unique
index on `users.email` and the identity sequence on `refresh_tokens.id` are both
reproduced, because a fake that is more permissive than production turns green
unit tests into false confidence.
"""

from __future__ import annotations

from datetime import datetime
from itertools import count
from uuid import UUID

from beff.core.ids import uuid7
from beff.db.base import utcnow
from beff.modules.auth.models import RefreshToken, User

__all__ = ["InMemoryRefreshTokenRepository", "InMemoryUserRepository"]


class InMemoryUserRepository:
    """A `UserRepository` backed by a list."""

    def __init__(self, users: list[User] | None = None) -> None:
        self.users: list[User] = list(users or [])

    async def get_active_by_email(self, email: str) -> User | None:
        return next(
            (u for u in self.users if u.email == email and u.deleted_at is None),
            None,
        )

    async def get_active_by_id(self, user_id: UUID) -> User | None:
        return next(
            (u for u in self.users if u.id == user_id and u.deleted_at is None),
            None,
        )

    async def add(self, user: User) -> User:
        existing = await self.get_active_by_email(user.email)
        if existing is not None:
            # Mirrors `uq_users_email_active`. A fake that let this through
            # would make the service's duplicate check look untested.
            raise ValueError(f"duplicate live email: {user.email}")
        # The fake stands in for the INSERT, so it owes the caller everything
        # the INSERT would have filled in. `id` comes from a Python-side
        # `default=uuid7` and the timestamps from a server default; either way
        # an unflushed instance has `None` at runtime even though the mapped
        # types say otherwise. `getattr` rather than `is None` because the
        # direct comparison is statically unreachable and mypy is right.
        #
        # Leaving the timestamps unset was not a cosmetic gap: `UserResponse`
        # requires `created_at`, so every HTTP-level test failed on a 500 that
        # no unit test could see.
        if getattr(user, "id", None) is None:
            user.id = uuid7()
        now = utcnow()
        if getattr(user, "created_at", None) is None:
            user.created_at = now
        if getattr(user, "updated_at", None) is None:
            user.updated_at = now
        self.users.append(user)
        return user


class InMemoryRefreshTokenRepository:
    """A `RefreshTokenRepository` backed by a list."""

    def __init__(self) -> None:
        self.tokens: list[RefreshToken] = []
        self._ids = count(1)

    async def add(self, token: RefreshToken) -> RefreshToken:
        token.id = next(self._ids)
        self.tokens.append(token)
        return token

    async def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        return next((t for t in self.tokens if t.token_hash == token_hash), None)

    async def mark_used(self, token: RefreshToken, *, at: datetime) -> None:
        token.used_at = at

    async def revoke_family(self, family_id: UUID, *, at: datetime, reason: str) -> int:
        affected = [t for t in self.tokens if t.family_id == family_id and t.revoked_at is None]
        for token in affected:
            token.revoked_at = at
            token.revoked_reason = reason
        return len(affected)

    async def list_family(self, family_id: UUID) -> list[RefreshToken]:
        return sorted(
            (t for t in self.tokens if t.family_id == family_id),
            key=lambda t: (t.issued_at, t.id),
        )
