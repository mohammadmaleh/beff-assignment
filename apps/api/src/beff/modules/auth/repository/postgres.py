"""PostgreSQL implementations of the auth repositories."""

from __future__ import annotations

from datetime import datetime
from typing import Any, cast
from uuid import UUID

from sqlalchemy import CursorResult, delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from beff.modules.auth.models import EmailVerificationToken, RefreshToken, User

__all__ = [
    "PostgresEmailVerificationTokenRepository",
    "PostgresRefreshTokenRepository",
    "PostgresUserRepository",
]


class PostgresUserRepository:
    """Satisfies `UserRepository` structurally — note the absence of a base class."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_active_by_email(self, email: str) -> User | None:
        result = await self._session.execute(
            select(User).where(User.email == email, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_active_by_id(self, user_id: UUID) -> User | None:
        result = await self._session.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def add(self, user: User) -> User:
        self._session.add(user)
        # Flush, not commit: the identity column and any server default have to
        # be populated before the caller can use them, but the transaction
        # belongs to the request.
        await self._session.flush()
        return user

    async def mark_email_verified(self, user: User, *, at: datetime) -> User:
        """Stamp `email_verified_at` unless it is already set.

        The guard is not defensive coding: following the link twice is normal —
        mail clients prefetch, and people double-click — and without it the
        second visit would rewrite the moment the address was confirmed.
        """
        if user.email_verified_at is None:
            user.email_verified_at = at
            await self._session.flush()
        return user


class PostgresRefreshTokenRepository:
    """Satisfies `RefreshTokenRepository` structurally."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, token: RefreshToken) -> RefreshToken:
        self._session.add(token)
        await self._session.flush()
        return token

    async def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        result = await self._session.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def mark_used(self, token: RefreshToken, *, at: datetime) -> None:
        token.used_at = at
        await self._session.flush()

    async def revoke_family(self, family_id: UUID, *, at: datetime, reason: str) -> int:
        """Revoke the whole family in one UPDATE.

        `revoked_at IS NULL` in the predicate makes this idempotent: a second
        replay arriving concurrently revokes nothing and reports zero, rather
        than overwriting the timestamp of the revocation that already happened.
        """
        result = await self._session.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=at, revoked_reason=reason)
        )
        await self._session.flush()
        # `execute()` is typed as returning `Result`, but an UPDATE always
        # yields a `CursorResult` — `rowcount` is only defined on the
        # latter. The narrowing is the shape of the statement, not a guess.
        return cast("CursorResult[Any]", result).rowcount

    async def list_family(self, family_id: UUID) -> list[RefreshToken]:
        result = await self._session.execute(
            select(RefreshToken)
            .where(RefreshToken.family_id == family_id)
            .order_by(RefreshToken.issued_at, RefreshToken.id)
        )
        return list(result.scalars())


class PostgresEmailVerificationTokenRepository:
    """Satisfies `EmailVerificationTokenRepository` structurally."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, token: EmailVerificationToken) -> EmailVerificationToken:
        self._session.add(token)
        await self._session.flush()
        return token

    async def get_by_hash(self, token_hash: str) -> EmailVerificationToken | None:
        result = await self._session.execute(
            select(EmailVerificationToken).where(EmailVerificationToken.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def consume(self, token: EmailVerificationToken, *, at: datetime) -> None:
        token.consumed_at = at
        await self._session.flush()

    async def invalidate_outstanding(self, user_id: UUID, *, at: datetime) -> int:
        """Consume every live token for this user in one UPDATE.

        `consumed_at IS NULL` in the predicate makes it idempotent: two resends
        racing do not overwrite each other's timestamps, and the count is what
        the second one honestly reports.
        """
        result = await self._session.execute(
            update(EmailVerificationToken)
            .where(
                EmailVerificationToken.user_id == user_id,
                EmailVerificationToken.consumed_at.is_(None),
            )
            .values(consumed_at=at)
        )
        await self._session.flush()
        return cast("CursorResult[Any]", result).rowcount

    async def delete_for_user(self, user_id: UUID) -> int:
        result = await self._session.execute(
            delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id)
        )
        await self._session.flush()
        return cast("CursorResult[Any]", result).rowcount
