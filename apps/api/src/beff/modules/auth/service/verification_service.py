"""Proving that whoever registered can read the address they registered with.

Nothing here signs anyone in and nothing here blocks anyone out. Following the
link stamps `users.email_verified_at`; the product decides what that is worth.
That separation is deliberate — a verification flow that also authenticates is
a login bypass one refactor away.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Final

from beff.core.email import EmailDelivery, EmailOutbox
from beff.core.security import generate_verification_token, hash_opaque_token
from beff.db.base import utcnow
from beff.modules.auth.emails import EmailLocale, render_verification_email
from beff.modules.auth.errors import (
    EmailAlreadyVerifiedError,
    VerificationTokenExpiredError,
    VerificationTokenInvalidError,
)
from beff.modules.auth.models import EmailVerificationToken, User
from beff.modules.auth.repository import EmailVerificationTokenRepository, UserRepository

__all__ = ["VERIFICATION_PURPOSE", "EmailVerificationService"]

# Names the row in `email_deliveries`, so an operator can answer "did the
# verification mail go out" without reading subject lines in two languages.
VERIFICATION_PURPOSE: Final = "email_verification"


class EmailVerificationService:
    """Issuing, resending and redeeming verification links."""

    def __init__(
        self,
        users: UserRepository,
        tokens: EmailVerificationTokenRepository,
        outbox: EmailOutbox,
        *,
        base_url: str,
        ttl_seconds: int,
        clock: Callable[[], datetime] = utcnow,
    ) -> None:
        self._users = users
        self._tokens = tokens
        self._outbox = outbox
        self._base_url = base_url
        self._ttl_seconds = ttl_seconds
        # Injected, never read from `utcnow` inline. Every boundary here —
        # expiry, issue time, consumption — is derived from "now", and a test
        # that cannot pin it gets fixtures that drift between two calls in the
        # same method. That reads as a service bug and is not one.
        self._clock = clock

    async def issue(self, user: User, *, locale: EmailLocale) -> EmailDelivery:
        """Mint a link and queue the message that carries it.

        Any token already outstanding is consumed first, so a resend does not
        leave two working links in two inboxes — the older message is the one
        more likely to have been forwarded, and it is now dead.
        """
        now = self._clock()
        await self._tokens.invalidate_outstanding(user.id, at=now)

        token = generate_verification_token()
        await self._tokens.add(
            EmailVerificationToken(
                user_id=user.id,
                # Only the hash is stored. Following one of these proves control
                # of an address, so a database leak must not hand over live
                # links — the same reasoning as `refresh_tokens`.
                token_hash=hash_opaque_token(token),
                issued_at=now,
                expires_at=now + timedelta(seconds=self._ttl_seconds),
            )
        )

        message = render_verification_email(
            to=user.email,
            display_name=user.display_name,
            token=token,
            base_url=self._base_url,
            locale=locale,
            ttl_seconds=self._ttl_seconds,
        )

        # Queued in the caller's transaction, not sent. A registration that
        # rolls back must not leave a verification mail on its way to an account
        # that does not exist — which is the entire reason this is an outbox and
        # not an SMTP call in the request handler.
        return await self._outbox.enqueue(
            EmailDelivery(
                user_id=user.id,
                purpose=VERIFICATION_PURPOSE,
                recipient=message.to,
                subject=message.subject,
                body_text=message.text,
                body_html=message.html,
            )
        )

    async def resend(self, user: User, *, locale: EmailLocale) -> EmailDelivery:
        """Queue another link for a user who has not confirmed yet.

        **This is the idempotency boundary.** A message already queued and not
        yet sent carries a token that is still live, so the right answer to a
        second click is that one — not a new token, which would kill the link in
        the message currently on its way out.
        """
        if user.email_verified_at is not None:
            raise EmailAlreadyVerifiedError

        in_flight = await self._outbox.pending_for_user(user.id, purpose=VERIFICATION_PURPOSE)
        if in_flight is not None:
            return in_flight

        return await self.issue(user, locale=locale)

    async def verify(self, presented_token: str) -> User:
        """Redeem a link. Returns the user it belonged to.

        The token is looked up by hash, so a value that was never issued and one
        that was issued to somebody else are the same lookup — there is no
        branch here that a guesser could time.
        """
        if not presented_token:
            raise VerificationTokenInvalidError

        record = await self._tokens.get_by_hash(hash_opaque_token(presented_token))
        if record is None or record.consumed_at is not None:
            raise VerificationTokenInvalidError

        now = self._clock()
        if record.expires_at <= now:
            # Consumed on the way out. An expired token is spent either way, and
            # leaving it live would let it be presented again forever to learn
            # the same nothing.
            await self._tokens.consume(record, at=now)
            raise VerificationTokenExpiredError

        user = await self._users.get_active_by_id(record.user_id)
        if user is None:
            # The token was genuine and its owner has since been erased. Not
            # "expired" — there is no new link to ask for.
            await self._tokens.consume(record, at=now)
            raise VerificationTokenInvalidError

        await self._tokens.consume(record, at=now)
        # Idempotent in the repository: an already-verified user keeps the
        # timestamp they had, so a mail client prefetching the link does not
        # rewrite when the address was confirmed.
        return await self._users.mark_email_verified(user, at=now)
