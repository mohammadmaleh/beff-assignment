"""Refresh-token rotation with family-wide reuse detection.

The model, in one paragraph. A login starts a **family**. Every refresh spends
the presented token and issues a new one in the same family, so at any moment
exactly one token in the family is live. Presenting a token that has already
been spent therefore means the chain forked - and a chain only forks if someone
other than the legitimate client has a copy. The response is to revoke the whole
family, not just the replayed token: the thief may already hold the newest one,
and revoking only what was presented would leave them holding it.

The cost of that design is a false positive, which ADR-0003 calls out: two
browser tabs refreshing at the same moment both spend the same token and the
second one looks exactly like theft. `grace_seconds` is the answer - a replay
arriving within the window is treated as the race it almost certainly is and
gets a fresh token in the same family; a replay arriving after it is treated as
theft. The window is short by design; it is the interval during which a stolen
token still works, traded against not signing users out for opening two tabs.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from beff.core.security import generate_refresh_token, hash_refresh_token
from beff.db.base import utcnow
from beff.modules.auth.errors import (
    RefreshTokenExpiredError,
    RefreshTokenInvalidError,
    RefreshTokenReusedError,
)
from beff.modules.auth.models import RefreshToken
from beff.modules.auth.repository import RefreshTokenRepository

__all__ = ["IssuedRefreshToken", "RefreshTokenService"]

REVOKED_BY_LOGOUT = "logout"
REVOKED_BY_REUSE = "reuse_detected"


@dataclass(frozen=True, slots=True)
class IssuedRefreshToken:
    """A newly minted token and its stored row.

    `token` is the plaintext, and this is the only place it ever exists outside
    the client's cookie - the database holds a SHA-256 of it and nothing else.
    """

    token: str
    record: RefreshToken


class RefreshTokenService:
    """Issues, rotates and revokes refresh-token families."""

    def __init__(
        self,
        repository: RefreshTokenRepository,
        *,
        ttl_seconds: int,
        grace_seconds: int,
        clock: Callable[[], datetime] = utcnow,
    ) -> None:
        self._repository = repository
        self._ttl = timedelta(seconds=ttl_seconds)
        self._grace = timedelta(seconds=grace_seconds)
        # Injected so tests can move time without a freezing library, and so
        # "now" is read once per operation rather than drifting mid-method.
        self._clock = clock

    async def issue(self, user_id: UUID, *, family_id: UUID | None = None) -> IssuedRefreshToken:
        """Mint a token. Omit `family_id` to start a new family - i.e. a login."""
        now = self._clock()
        token = generate_refresh_token()
        record = await self._repository.add(
            RefreshToken(
                user_id=user_id,
                family_id=family_id or uuid4(),
                token_hash=hash_refresh_token(token),
                issued_at=now,
                expires_at=now + self._ttl,
            )
        )
        return IssuedRefreshToken(token=token, record=record)

    async def rotate(self, presented: str) -> IssuedRefreshToken:
        """Spend `presented` and return its successor in the same family.

        Raises `RefreshTokenReusedError` - after revoking the entire family - if
        a spent token is replayed outside the grace window.
        """
        now = self._clock()
        record = await self._require_live_token(presented, now=now)

        if record.used_at is not None:
            if now - record.used_at > self._grace:
                await self._repository.revoke_family(
                    record.family_id, at=now, reason=REVOKED_BY_REUSE
                )
                raise RefreshTokenReusedError
            # Inside the window: two tabs raced. Issue into the same family
            # without spending anything again - the token is already spent.
            return await self.issue(record.user_id, family_id=record.family_id)

        await self._repository.mark_used(record, at=now)
        return await self.issue(record.user_id, family_id=record.family_id)

    async def revoke_family_of(self, presented: str) -> int:
        """Revoke the whole family a token belongs to. This is what logout does.

        Logging out kills the family rather than the single token, because the
        point of signing out is that the session is over - leaving siblings
        alive would make "log out" mean "log out of this tab".

        Unknown tokens are ignored rather than raising: logging out is
        idempotent, and a client with a stale cookie should still end up logged
        out.
        """
        now = self._clock()
        record = await self._repository.get_by_hash(hash_refresh_token(presented))
        if record is None:
            return 0
        return await self._repository.revoke_family(
            record.family_id, at=now, reason=REVOKED_BY_LOGOUT
        )

    async def _require_live_token(self, presented: str, *, now: datetime) -> RefreshToken:
        record = await self._repository.get_by_hash(hash_refresh_token(presented))

        if record is None:
            raise RefreshTokenInvalidError

        if record.revoked_at is not None:
            # The family is already dead. If it died from a detected reuse, say
            # so - the client must stop retrying and send the user to sign in.
            if record.revoked_reason == REVOKED_BY_REUSE:
                raise RefreshTokenReusedError
            raise RefreshTokenInvalidError

        if record.expires_at <= now:
            raise RefreshTokenExpiredError

        return record
