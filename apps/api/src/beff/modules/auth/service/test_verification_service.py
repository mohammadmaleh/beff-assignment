"""Issuing, resending and redeeming verification links.

Every boundary here is derived from "now", so the clock is injected and pinned.
A test that let the service read the wall clock would have fixtures drifting
between two calls inside one method — which reads as a service bug and is not
one.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from beff.core.email.outbox import InMemoryEmailOutbox
from beff.core.security import generate_verification_token, hash_opaque_token
from beff.modules.auth.errors import (
    EmailAlreadyVerifiedError,
    VerificationTokenExpiredError,
    VerificationTokenInvalidError,
)
from beff.modules.auth.models import EmailVerificationToken, User
from beff.modules.auth.repository import (
    InMemoryEmailVerificationTokenRepository,
    InMemoryUserRepository,
)
from beff.modules.auth.service.verification_service import (
    VERIFICATION_PURPOSE,
    EmailVerificationService,
)

NOW = datetime(2026, 8, 5, 12, 0, tzinfo=UTC)
TTL = 86400
BASE = "https://beff.test"


class Clock:
    """A movable clock, so expiry can be tested without sleeping."""

    def __init__(self, at: datetime = NOW) -> None:
        self.at = at

    def __call__(self) -> datetime:
        return self.at


async def _fixture(
    *, verified: bool = False, at: datetime = NOW
) -> tuple[EmailVerificationService, User, InMemoryEmailOutbox, Clock]:
    users = InMemoryUserRepository()
    tokens = InMemoryEmailVerificationTokenRepository()
    outbox = InMemoryEmailOutbox()
    clock = Clock(at)

    user = await users.add(
        User(
            email="ada@example.test",
            password_hash="argon2",
            display_name="Ada",
            role="member",
            email_verified_at=at if verified else None,
        )
    )

    service = EmailVerificationService(
        users, tokens, outbox, base_url=BASE, ttl_seconds=TTL, clock=clock
    )
    return service, user, outbox, clock


def _token_from(outbox: InMemoryEmailOutbox) -> str:
    """Pull the link's token back out of the queued message body.

    Deliberately read from the *message*, not from a return value the service
    could hand a test privately. What is under test is that a real reader can
    complete the flow with what actually arrives in their inbox.
    """
    body = outbox.deliveries[-1].body_text
    marker = "token="
    start = body.index(marker) + len(marker)
    end = len(body)
    for terminator in ("\n", " "):
        found = body.find(terminator, start)
        if found != -1:
            end = min(end, found)
    return body[start:end]


async def test_issuing_queues_exactly_one_message() -> None:
    service, user, outbox, _ = await _fixture()

    await service.issue(user, locale="en")

    assert len(outbox.deliveries) == 1
    assert outbox.deliveries[0].purpose == VERIFICATION_PURPOSE
    assert outbox.deliveries[0].recipient == "ada@example.test"
    assert outbox.deliveries[0].status == "pending"


async def test_the_queued_message_is_in_the_requested_language() -> None:
    """The locale reaches the rendered body, not just the function signature."""
    service, user, outbox, _ = await _fixture()

    await service.issue(user, locale="de")

    assert outbox.deliveries[0].subject == "Bestätigen Sie Ihre E-Mail-Adresse"


async def test_only_the_hash_of_the_token_is_stored() -> None:
    """A database leak must not hand over live verification links.

    Following one proves control of an address, which is a step in most
    account-takeover chains — so this is the same rule as refresh tokens, for
    the same reason.
    """
    service, user, outbox, _ = await _fixture()

    await service.issue(user, locale="en")
    token = _token_from(outbox)

    stored = service._tokens.tokens[0]  # type: ignore[attr-defined]
    assert stored.token_hash != token
    assert stored.token_hash == hash_opaque_token(token)


async def test_a_link_verifies_its_owner() -> None:
    service, user, outbox, _ = await _fixture()
    await service.issue(user, locale="en")

    verified = await service.verify(_token_from(outbox))

    assert verified.id == user.id
    assert verified.email_verified_at == NOW


async def test_a_link_cannot_be_redeemed_twice() -> None:
    """Single use. The second attempt is reported honestly rather than silently
    succeeding, so a leaked link cannot be replayed indefinitely."""
    service, user, outbox, _ = await _fixture()
    await service.issue(user, locale="en")
    token = _token_from(outbox)

    await service.verify(token)

    with pytest.raises(VerificationTokenInvalidError):
        await service.verify(token)


async def test_verifying_twice_keeps_the_original_timestamp() -> None:
    """Mail clients prefetch links and people double-click.

    The column records *when* an address was confirmed, and a second visit
    rewriting it would destroy the one fact it exists to hold. The guard lives
    in the repository, which is why the fake reproduces it.
    """
    service, user, outbox, clock = await _fixture()
    await service.issue(user, locale="en")
    await service.verify(_token_from(outbox))

    clock.at = NOW + timedelta(days=3)
    await service.issue(user, locale="en")
    verified = await service.verify(_token_from(outbox))

    assert verified.email_verified_at == NOW


async def test_an_expired_link_is_refused() -> None:
    service, user, outbox, clock = await _fixture()
    await service.issue(user, locale="en")
    token = _token_from(outbox)

    clock.at = NOW + timedelta(seconds=TTL + 1)

    with pytest.raises(VerificationTokenExpiredError):
        await service.verify(token)


async def test_a_link_is_still_good_one_second_before_it_expires() -> None:
    """The boundary, from the other side. A comparison written `>=` instead of
    `>` would expire every link a full TTL early and nothing else would notice."""
    service, user, outbox, clock = await _fixture()
    await service.issue(user, locale="en")
    token = _token_from(outbox)

    clock.at = NOW + timedelta(seconds=TTL - 1)

    assert (await service.verify(token)).email_verified_at is not None


async def test_an_expired_link_is_spent_by_the_attempt() -> None:
    """It is dead either way, and leaving it live lets it be presented forever
    to learn the same nothing."""
    service, user, outbox, clock = await _fixture()
    await service.issue(user, locale="en")
    token = _token_from(outbox)
    clock.at = NOW + timedelta(seconds=TTL + 1)

    with pytest.raises(VerificationTokenExpiredError):
        await service.verify(token)

    with pytest.raises(VerificationTokenInvalidError):
        await service.verify(token)


async def test_an_unknown_token_is_refused() -> None:
    service, _, _, _ = await _fixture()

    with pytest.raises(VerificationTokenInvalidError):
        await service.verify(generate_verification_token())


async def test_an_empty_token_is_refused_without_a_lookup() -> None:
    """The route's schema has a length floor, but the service is called from the
    worker and from tests too, and it owes nothing to a caller who sends ""."""
    service, _, _, _ = await _fixture()

    with pytest.raises(VerificationTokenInvalidError):
        await service.verify("")


async def test_a_token_whose_owner_was_erased_is_refused() -> None:
    """Not "expired" — there is no new link to ask for.

    The GDPR erasure path deletes these rows, so this is the belt to that
    braces: a token that somehow outlives its account must not resurrect it.
    """
    service, user, outbox, _ = await _fixture()
    await service.issue(user, locale="en")
    token = _token_from(outbox)

    user.deleted_at = NOW

    with pytest.raises(VerificationTokenInvalidError):
        await service.verify(token)


async def test_issuing_again_kills_the_previous_link() -> None:
    """Two live links in two inboxes is one more than anybody needs, and the
    older message is the one more likely to have been forwarded."""
    service, user, outbox, _ = await _fixture()
    await service.issue(user, locale="en")
    first = _token_from(outbox)

    await service.issue(user, locale="en")
    second = _token_from(outbox)

    assert first != second
    with pytest.raises(VerificationTokenInvalidError):
        await service.verify(first)
    assert (await service.verify(second)).email_verified_at == NOW


async def test_resending_while_a_message_is_still_queued_returns_that_message() -> None:
    """The idempotency boundary, and the reason it is not simply "always issue".

    A new token would kill the link inside the message currently on its way out,
    so a double-click would post a dead link to the user's inbox — which is
    worse than doing nothing.
    """
    service, user, outbox, _ = await _fixture()
    first = await service.resend(user, locale="en")
    token = _token_from(outbox)

    second = await service.resend(user, locale="en")

    assert len(outbox.deliveries) == 1
    assert first.id == second.id
    assert (await service.verify(token)).email_verified_at == NOW


async def test_resending_after_the_first_was_sent_queues_a_new_one() -> None:
    """Otherwise a user whose first message never arrived could never get
    another: the long-delivered row would suppress every resend forever."""
    service, user, outbox, _ = await _fixture()
    await service.issue(user, locale="en")
    outbox.deliveries[0].status = "sent"

    await service.resend(user, locale="en")

    assert len(outbox.deliveries) == 2


async def test_resending_to_a_verified_account_is_refused() -> None:
    service, user, _, _ = await _fixture(verified=True)

    with pytest.raises(EmailAlreadyVerifiedError):
        await service.resend(user, locale="en")


async def test_verification_does_not_produce_a_session() -> None:
    """A link that arrives by email and yields a session is a login bypass —
    anyone with read access to the inbox, including a forwarding rule nobody
    remembers, would get one. `verify` returns a `User`, and that is all."""
    service, user, outbox, _ = await _fixture()
    await service.issue(user, locale="en")

    result = await service.verify(_token_from(outbox))

    assert isinstance(result, User)
    assert not hasattr(result, "access_token")


async def test_the_token_row_expires_exactly_ttl_seconds_after_issue() -> None:
    service, user, _, _ = await _fixture()

    await service.issue(user, locale="en")

    stored: EmailVerificationToken = service._tokens.tokens[0]  # type: ignore[attr-defined]
    assert stored.issued_at == NOW
    assert stored.expires_at == NOW + timedelta(seconds=TTL)
