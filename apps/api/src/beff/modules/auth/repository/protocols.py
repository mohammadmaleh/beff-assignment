"""Repository contracts.

`typing.Protocol`, not an abstract base class. A service declares the shape it
needs and any object with matching methods satisfies it structurally - so a test
double is a plain class with no import of, and no inheritance from, the real
repository. Change the protocol and mypy flags every implementation, including
the fakes, which is exactly the drift a hand-rolled mock hides.

None of these methods commit. The unit of work is the HTTP request, owned by the
`get_session` dependency, so a service cannot half-commit a use case.
"""

from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from beff.modules.auth.models import EmailVerificationToken, RefreshToken, User

__all__ = [
    "EmailVerificationTokenRepository",
    "RefreshTokenRepository",
    "UserRepository",
]


class UserRepository(Protocol):
    """Access to the `users` table.

    Every read is scoped to *live* users. A soft-deleted account must behave as
    if it does not exist - otherwise an erased user could still sign in, which
    would make erasure a lie.
    """

    async def get_active_by_email(self, email: str) -> User | None: ...

    async def get_active_by_id(self, user_id: UUID) -> User | None: ...

    async def add(self, user: User) -> User: ...

    async def mark_email_verified(self, user: User, *, at: datetime) -> User:
        """Stamp `email_verified_at`, once.

        Idempotent: a user who is already verified keeps their original
        timestamp. Overwriting it would mean a second click on an old link
        silently rewrites when the address was confirmed, which is the one fact
        this column exists to record.
        """
        ...


class RefreshTokenRepository(Protocol):
    """Access to the `refresh_tokens` table."""

    async def add(self, token: RefreshToken) -> RefreshToken: ...

    async def get_by_hash(self, token_hash: str) -> RefreshToken | None: ...

    async def mark_used(self, token: RefreshToken, *, at: datetime) -> None:
        """Stamp `used_at`. A stamped token may never be redeemed again."""
        ...

    async def revoke_family(self, family_id: UUID, *, at: datetime, reason: str) -> int:
        """Revoke every unrevoked token in a family. Returns how many were hit.

        One statement rather than a read-then-write loop: two concurrent
        replays of a stolen token would otherwise interleave, and the count is
        what the audit log records.
        """
        ...

    async def list_family(self, family_id: UUID) -> list[RefreshToken]:
        """Every token in a family, oldest first. Used by tests and by DSAR export."""
        ...


class EmailVerificationTokenRepository(Protocol):
    """Access to the `email_verification_tokens` table."""

    async def add(self, token: EmailVerificationToken) -> EmailVerificationToken: ...

    async def get_by_hash(self, token_hash: str) -> EmailVerificationToken | None: ...

    async def consume(self, token: EmailVerificationToken, *, at: datetime) -> None:
        """Stamp `consumed_at`. A stamped token may never be redeemed again."""
        ...

    async def invalidate_outstanding(self, user_id: UUID, *, at: datetime) -> int:
        """Consume every live token for this user. Returns how many were hit.

        Called before issuing a new one, so a resend does not leave two working
        links in two different inboxes - the older message is the one more
        likely to have been forwarded or exposed, and it is now dead.
        """
        ...

    async def delete_for_user(self, user_id: UUID) -> int:
        """Erasure. Nothing here survives the account."""
        ...
