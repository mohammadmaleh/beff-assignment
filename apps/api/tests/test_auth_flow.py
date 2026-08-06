"""The auth flow over HTTP, end to end.

These are the tests that exercise the parts the unit suite cannot reach: status
codes, cookie attributes, the RFC 9457 envelope, and the fact that the refresh
token is a cookie and never a body field.

They run against the in-memory repositories rather than PostgreSQL. The
persistence layer is covered by `test_migrations.py`; what is under test here is
the HTTP surface, and binding it to a container would make the fastest, most
frequently run tests in the suite depend on Docker for no added signal.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from beff.core.config import Settings
from beff.core.email import InMemoryEmailOutbox
from beff.main import create_app
from beff.modules.auth.dependencies import (
    get_auth_service,
    get_verification_service,
    login_rate_limit,
    register_rate_limit,
    resend_verification_rate_limit,
)
from beff.modules.auth.repository import (
    InMemoryEmailVerificationTokenRepository,
    InMemoryRefreshTokenRepository,
    InMemoryUserRepository,
)
from beff.modules.auth.router.cookies import REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH
from beff.modules.auth.service import AuthService, EmailVerificationService, RefreshTokenService

PASSWORD = "correct horse battery staple"
EMAIL = "ada@beff.example"

REGISTRATION = {"email": EMAIL, "password": PASSWORD, "display_name": "Ada Lovelace"}

# Zero grace, so a replayed token is unambiguously a replay rather than a
# retried request arriving inside the window a flaky network is forgiven.
GRACE_SECONDS = 0


@pytest.fixture
def tokens() -> InMemoryRefreshTokenRepository:
    return InMemoryRefreshTokenRepository()


@pytest.fixture
def users() -> InMemoryUserRepository:
    return InMemoryUserRepository()


@pytest.fixture
def verification_tokens() -> InMemoryEmailVerificationTokenRepository:
    return InMemoryEmailVerificationTokenRepository()


@pytest.fixture
def outbox() -> InMemoryEmailOutbox:
    return InMemoryEmailOutbox()


@pytest.fixture
async def api(
    users: InMemoryUserRepository,
    tokens: InMemoryRefreshTokenRepository,
    verification_tokens: InMemoryEmailVerificationTokenRepository,
    outbox: InMemoryEmailOutbox,
) -> AsyncIterator[AsyncClient]:
    """The real app, with only the repositories swapped.

    Overriding `get_auth_service` rather than the session means every router,
    dependency, error handler and cookie behaviour under test is the shipped
    one. Only the storage is a fake.

    **Every** service a route under test depends on has to be overridden, not
    just the obvious one. `register` gained `get_verification_service`, and
    because this fixture only replaced `get_auth_service`, the new dependency
    went on constructing a real PostgreSQL session against a deliberately
    unusable URL — which failed as an event-loop error rather than anything
    resembling "you forgot an override". This repo has hit that exact shape once
    before, with a rate limiter.
    """
    settings = Settings(
        database_url="postgresql+asyncpg://unused/unused",
        jwt_secret="integration-secret-with-enough-entropy-for-rfc-7518",
        ip_hash_salt="integration-salt",
    )

    def override() -> AuthService:
        return AuthService(
            users,
            RefreshTokenService(
                tokens,
                ttl_seconds=settings.refresh_token_ttl_seconds,
                grace_seconds=GRACE_SECONDS,
            ),
            jwt_secret=settings.jwt_secret,
            jwt_algorithm=settings.jwt_algorithm,
            access_token_ttl_seconds=settings.access_token_ttl_seconds,
        )

    def override_verification() -> EmailVerificationService:
        return EmailVerificationService(
            users,
            verification_tokens,
            outbox,
            base_url="http://test",
            ttl_seconds=settings.email_verification_ttl_seconds,
        )

    app = create_app()
    app.dependency_overrides[get_auth_service] = override
    app.dependency_overrides[get_verification_service] = override_verification
    # Login and register carry rate limiters that need a real session. They are
    # covered against a live database in `test_rate_limit.py`, including that the
    # routes enforce them; leaving them live here would mean these tests silently
    # start 429ing the day someone adds an eleventh login case.
    app.dependency_overrides[login_rate_limit] = lambda: None
    app.dependency_overrides[register_rate_limit] = lambda: None
    app.dependency_overrides[resend_verification_rate_limit] = lambda: None

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


# ── Registration ─────────────────────────────────────────────────────────────


async def test_registration_returns_a_session_and_sets_the_cookie(api: AsyncClient) -> None:
    response = await api.post("/api/v1/auth/register", json=REGISTRATION)

    assert response.status_code == 201
    body = response.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == EMAIL
    assert REFRESH_COOKIE_NAME in response.cookies


async def test_the_refresh_token_never_appears_in_a_response_body(api: AsyncClient) -> None:
    """The whole point of the httpOnly cookie.

    A refresh token in the body is readable by any injected script, which is
    exactly the property the cookie exists to deny (ADR-0003). Asserting on the
    raw text catches it wherever in the payload it were to appear.
    """
    response = await api.post("/api/v1/auth/register", json=REGISTRATION)

    assert "refresh_token" not in response.text
    assert response.cookies[REFRESH_COOKIE_NAME] not in response.text


async def test_the_refresh_cookie_is_httponly_and_scoped_to_the_auth_endpoints(
    api: AsyncClient,
) -> None:
    response = await api.post("/api/v1/auth/register", json=REGISTRATION)

    header = response.headers["set-cookie"]
    assert "HttpOnly" in header
    assert f"Path={REFRESH_COOKIE_PATH}" in header
    # Blocks the cookie on cross-site POSTs, which is what stops a third-party
    # page silently refreshing someone's session.
    assert "SameSite=lax" in header.lower().replace("samesite=lax", "SameSite=lax")


async def test_the_password_is_never_echoed_back(api: AsyncClient) -> None:
    response = await api.post("/api/v1/auth/register", json=REGISTRATION)

    assert PASSWORD not in response.text
    assert "password_hash" not in response.text


async def test_registering_a_taken_email_is_a_problem_document(api: AsyncClient) -> None:
    await api.post("/api/v1/auth/register", json=REGISTRATION)

    response = await api.post("/api/v1/auth/register", json=REGISTRATION)

    assert response.status_code == 409
    assert response.headers["content-type"].startswith("application/problem+json")
    problem = response.json()
    # The stable code is what the frontend translates. Parsing the English
    # `detail` would break the German locale the moment the wording changed.
    assert problem["code"] == "auth.email_already_registered"
    assert problem["status"] == 409


async def test_a_short_password_is_rejected_with_a_field_pointer(api: AsyncClient) -> None:
    response = await api.post(
        "/api/v1/auth/register",
        json={**REGISTRATION, "password": "short"},
    )

    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")
    problem = response.json()
    fields = {error["field"] for error in problem["errors"]}
    assert "password" in fields


async def test_a_malformed_email_names_the_email_field(api: AsyncClient) -> None:
    response = await api.post(
        "/api/v1/auth/register",
        json={**REGISTRATION, "email": "not-an-address"},
    )

    assert response.status_code == 422
    fields = {error["field"] for error in response.json()["errors"]}
    assert fields == {"email"}


# ── Login ────────────────────────────────────────────────────────────────────


async def test_login_returns_a_session(api: AsyncClient) -> None:
    await api.post("/api/v1/auth/register", json=REGISTRATION)

    response = await api.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD})

    assert response.status_code == 200
    assert response.json()["access_token"]


async def test_a_wrong_password_and_an_unknown_account_answer_identically(
    api: AsyncClient,
) -> None:
    """Anything else is a free account-enumeration oracle."""
    await api.post("/api/v1/auth/register", json=REGISTRATION)

    wrong = await api.post("/api/v1/auth/login", json={"email": EMAIL, "password": "nope"})
    unknown = await api.post(
        "/api/v1/auth/login", json={"email": "nobody@beff.example", "password": PASSWORD}
    )

    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["code"] == unknown.json()["code"] == "auth.invalid_credentials"
    assert wrong.json()["detail"] == unknown.json()["detail"]


# ── Bearer authentication ────────────────────────────────────────────────────


async def test_me_returns_the_signed_in_user(api: AsyncClient) -> None:
    session = (await api.post("/api/v1/auth/register", json=REGISTRATION)).json()

    response = await api.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {session['access_token']}"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == EMAIL


@pytest.mark.parametrize(
    "header",
    [
        pytest.param({}, id="absent"),
        pytest.param({"Authorization": "Bearer "}, id="empty"),
        pytest.param({"Authorization": "not-a-scheme abc"}, id="wrong-scheme"),
        pytest.param({"Authorization": "Bearer not.a.jwt"}, id="malformed"),
    ],
)
async def test_me_rejects_anything_but_a_valid_bearer_token(
    api: AsyncClient, header: dict[str, str]
) -> None:
    response = await api.get("/api/v1/auth/me", headers=header)

    assert response.status_code == 401
    # Every failure stays inside the RFC 9457 envelope. FastAPI's own
    # `OAuth2PasswordBearer` would emit its own body shape here instead.
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["code"] == "auth.access_token_invalid"


# ── Refresh and reuse detection ──────────────────────────────────────────────


async def test_refresh_rotates_the_cookie(api: AsyncClient) -> None:
    await api.post("/api/v1/auth/register", json=REGISTRATION)
    original = api.cookies[REFRESH_COOKIE_NAME]

    response = await api.post("/api/v1/auth/refresh")

    assert response.status_code == 200
    assert response.json()["access_token"]
    assert api.cookies[REFRESH_COOKIE_NAME] != original


async def test_refresh_without_a_cookie_says_so(api: AsyncClient) -> None:
    response = await api.post("/api/v1/auth/refresh")

    assert response.status_code == 401
    assert response.json()["code"] == "auth.refresh_token_missing"


async def test_replaying_a_used_refresh_token_revokes_the_whole_family(
    api: AsyncClient, tokens: InMemoryRefreshTokenRepository
) -> None:
    """**The ENG-28 verification.**

    Rotation on its own buys nothing: a stolen token still works until it is
    spent. What makes it worth doing is this — the moment a spent token is
    presented again, either the thief or the legitimate client is holding a copy
    that should not exist, and there is no way to tell which. The safe response
    is to end the session for both.
    """
    await api.post("/api/v1/auth/register", json=REGISTRATION)
    stolen = api.cookies[REFRESH_COOKIE_NAME]

    # The legitimate client refreshes, spending `stolen` and receiving its
    # successor.
    assert (await api.post("/api/v1/auth/refresh")).status_code == 200
    successor = api.cookies[REFRESH_COOKIE_NAME]
    assert successor != stolen

    # The thief presents the copy they kept.
    api.cookies.set(REFRESH_COOKIE_NAME, stolen, path=REFRESH_COOKIE_PATH)
    replay = await api.post("/api/v1/auth/refresh")

    assert replay.status_code == 401
    # A distinct code, so the frontend can say "you were signed out for your
    # security" instead of a generic error.
    assert replay.json()["code"] == "auth.refresh_token_reused"

    # Every token in the family is revoked — including the successor the
    # legitimate client is still holding.
    assert tokens.tokens
    assert all(token.revoked_at is not None for token in tokens.tokens)

    # And the successor is now worthless.
    api.cookies.set(REFRESH_COOKIE_NAME, successor, path=REFRESH_COOKIE_PATH)
    assert (await api.post("/api/v1/auth/refresh")).status_code == 401


# ── Logout ───────────────────────────────────────────────────────────────────


async def test_logout_clears_the_cookie_and_kills_the_session(api: AsyncClient) -> None:
    await api.post("/api/v1/auth/register", json=REGISTRATION)

    response = await api.post("/api/v1/auth/logout")

    assert response.status_code == 204
    assert not api.cookies.get(REFRESH_COOKIE_NAME)
    assert (await api.post("/api/v1/auth/refresh")).status_code == 401


async def test_logging_out_twice_is_not_an_error(api: AsyncClient) -> None:
    """Idempotent by design. A 401 on the second call would leave the cookie in
    the browser on the one path where clearing it matters most."""
    await api.post("/api/v1/auth/register", json=REGISTRATION)

    assert (await api.post("/api/v1/auth/logout")).status_code == 204
    assert (await api.post("/api/v1/auth/logout")).status_code == 204


async def test_logging_out_without_ever_signing_in_is_not_an_error(api: AsyncClient) -> None:
    assert (await api.post("/api/v1/auth/logout")).status_code == 204


# ── Email verification ───────────────────────────────────────────────────────


def _link_token(outbox: InMemoryEmailOutbox) -> str:
    """The token as a reader would get it: out of the message body.

    Deliberately not read from the token table. What is under test is that
    somebody who receives the email can finish the flow with what is actually in
    it — a test that reached into storage would pass against a message carrying
    the wrong link entirely.
    """
    body = outbox.deliveries[-1].body_text
    start = body.index("token=") + len("token=")
    end = min(
        (found for found in (body.find(c, start) for c in ("\n", " ")) if found != -1),
        default=len(body),
    )
    return body[start:end]


async def test_registration_queues_a_confirmation_email(
    api: AsyncClient, outbox: InMemoryEmailOutbox
) -> None:
    await api.post("/api/v1/auth/register", json=REGISTRATION)

    assert len(outbox.deliveries) == 1
    assert outbox.deliveries[0].recipient == EMAIL
    assert outbox.deliveries[0].purpose == "email_verification"
    # Queued, not sent. The worker sends it, and the API cannot honestly claim
    # delivery at the moment it answers.
    assert outbox.deliveries[0].status == "pending"


async def test_a_new_account_is_not_verified(api: AsyncClient) -> None:
    """Registration signs you in immediately and confirms nothing.

    The two are separate acts on purpose: making the account wait on an email
    would gate the product behind a system that is allowed to be slow.
    """
    response = await api.post("/api/v1/auth/register", json=REGISTRATION)

    assert response.json()["user"]["email_verified_at"] is None


async def test_the_email_language_follows_an_explicit_locale(
    api: AsyncClient, outbox: InMemoryEmailOutbox
) -> None:
    await api.post("/api/v1/auth/register", json={**REGISTRATION, "locale": "de"})

    assert outbox.deliveries[0].subject == "Bestätigen Sie Ihre E-Mail-Adresse"


async def test_the_email_language_falls_back_to_accept_language(
    api: AsyncClient, outbox: InMemoryEmailOutbox
) -> None:
    """A caller that sends no locale still gets the right language.

    This is the path a `curl`, a mobile client, or a frontend that forgets the
    field takes — and the alternative to negotiating is silently mailing English
    to a German speaker.
    """
    await api.post(
        "/api/v1/auth/register",
        json=REGISTRATION,
        headers={"accept-language": "de-DE,de;q=0.9,en;q=0.4"},
    )

    assert outbox.deliveries[0].subject == "Bestätigen Sie Ihre E-Mail-Adresse"


async def test_following_the_link_confirms_the_address(
    api: AsyncClient, outbox: InMemoryEmailOutbox
) -> None:
    session = (await api.post("/api/v1/auth/register", json=REGISTRATION)).json()

    response = await api.post("/api/v1/auth/verify-email", json={"token": _link_token(outbox)})

    assert response.status_code == 200
    assert response.json()["verified"] is True
    assert response.json()["user"]["email_verified_at"] is not None

    me = await api.get(
        "/api/v1/auth/me",
        headers={"authorization": f"Bearer {session['access_token']}"},
    )
    assert me.json()["email_verified_at"] is not None


async def test_confirming_needs_no_session(api: AsyncClient, outbox: InMemoryEmailOutbox) -> None:
    """The link is followed from a mail client, which may be on another device.

    Requiring a bearer token here would make the commonest path — read the mail
    on a phone, registered on a laptop — the one that fails.
    """
    await api.post("/api/v1/auth/register", json=REGISTRATION)
    token = _link_token(outbox)
    api.cookies.clear()

    response = await api.post("/api/v1/auth/verify-email", json={"token": token})

    assert response.status_code == 200


async def test_confirming_never_hands_back_a_session(
    api: AsyncClient, outbox: InMemoryEmailOutbox
) -> None:
    """A link that arrives by email and produces a session is a login bypass.

    Anyone with read access to the inbox — including a forwarding rule nobody
    remembers — would get one.
    """
    await api.post("/api/v1/auth/register", json=REGISTRATION)
    token = _link_token(outbox)
    api.cookies.clear()

    response = await api.post("/api/v1/auth/verify-email", json={"token": token})

    assert "access_token" not in response.text
    assert REFRESH_COOKIE_NAME not in response.cookies


async def test_a_link_cannot_be_used_twice(api: AsyncClient, outbox: InMemoryEmailOutbox) -> None:
    await api.post("/api/v1/auth/register", json=REGISTRATION)
    token = _link_token(outbox)

    assert (await api.post("/api/v1/auth/verify-email", json={"token": token})).status_code == 200

    second = await api.post("/api/v1/auth/verify-email", json={"token": token})
    assert second.status_code == 422
    assert second.json()["code"] == "auth.verification_token_invalid"


async def test_an_unknown_token_is_a_problem_document(api: AsyncClient) -> None:
    response = await api.post("/api/v1/auth/verify-email", json={"token": "not-a-real-token-value"})

    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["code"] == "auth.verification_token_invalid"


async def test_resending_needs_a_session(api: AsyncClient) -> None:
    """Anonymous resend would be an oracle *and* an amplifier: it would report
    whether an address is registered, and point our sending reputation at it."""
    response = await api.post("/api/v1/auth/verify-email/resend", json={})

    assert response.status_code == 401


async def test_resending_takes_no_address(api: AsyncClient) -> None:
    """`extra="forbid"` is the guard. Accepting an address would let any account
    holder mail any address a message that genuinely comes from us."""
    session = (await api.post("/api/v1/auth/register", json=REGISTRATION)).json()

    response = await api.post(
        "/api/v1/auth/verify-email/resend",
        json={"email": "someone-else@example.test"},
        headers={"authorization": f"Bearer {session['access_token']}"},
    )

    assert response.status_code == 422


async def test_resending_after_the_first_was_sent_queues_another(
    api: AsyncClient, outbox: InMemoryEmailOutbox
) -> None:
    session = (await api.post("/api/v1/auth/register", json=REGISTRATION)).json()
    outbox.deliveries[0].status = "sent"

    response = await api.post(
        "/api/v1/auth/verify-email/resend",
        json={"locale": "en"},
        headers={"authorization": f"Bearer {session['access_token']}"},
    )

    assert response.status_code == 202
    assert response.json() == {"queued": True, "recipient": EMAIL}
    assert len(outbox.deliveries) == 2


async def test_resending_while_one_is_still_queued_does_not_duplicate(
    api: AsyncClient, outbox: InMemoryEmailOutbox
) -> None:
    """A new token would kill the link in the message already on its way out, so
    a double-click would post a dead link to the user's inbox."""
    session = (await api.post("/api/v1/auth/register", json=REGISTRATION)).json()

    response = await api.post(
        "/api/v1/auth/verify-email/resend",
        json={},
        headers={"authorization": f"Bearer {session['access_token']}"},
    )

    assert response.status_code == 202
    assert len(outbox.deliveries) == 1


async def test_resending_to_a_confirmed_address_is_a_conflict(
    api: AsyncClient, outbox: InMemoryEmailOutbox
) -> None:
    session = (await api.post("/api/v1/auth/register", json=REGISTRATION)).json()
    await api.post("/api/v1/auth/verify-email", json={"token": _link_token(outbox)})

    response = await api.post(
        "/api/v1/auth/verify-email/resend",
        json={},
        headers={"authorization": f"Bearer {session['access_token']}"},
    )

    assert response.status_code == 409
    assert response.json()["code"] == "auth.email_already_verified"
