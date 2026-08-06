"""Rate limits on the credential endpoints.

Login is the highest-value target in the API: credential stuffing is cheap,
automated, and the only thing standing between a leaked password list and an
account takeover. Argon2 makes each attempt expensive for *us* as well as the
attacker, so an unlimited endpoint is also a denial-of-service surface.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from beff.core.config import Settings, get_settings
from beff.core.ratelimit import RateLimit, RateLimiter, get_limiter_session
from beff.core.security import hash_ip

__all__ = [
    "LOGIN_LIMIT",
    "REGISTER_LIMIT",
    "RESEND_VERIFICATION_LIMIT",
    "login_rate_limit",
    "register_rate_limit",
    "resend_verification_rate_limit",
]

# Ten attempts per fifteen minutes from one origin. A person who has genuinely
# forgotten which password they used gets several goes; a script gets nowhere.
# Deliberately not so tight that a shared office NAT locks out a whole floor -
# the key is an IP hash, and behind CGNAT that is a lot of people.
LOGIN_LIMIT = RateLimit(limit=10, window_seconds=900)

# Registration is a write that creates rows and now also queues one email, so it
# needs less headroom than login and is not something to leave open.
REGISTER_LIMIT = RateLimit(limit=5, window_seconds=3600)

# Resending is the one endpoint here that makes *us* send traffic to a third
# party, which makes it the one an attacker would use to mail-bomb an address
# they do not own - or to burn a sending reputation that takes weeks to rebuild.
# Three an hour is generous for a person who did not receive the first, and
# useless as an amplifier.
RESEND_VERIFICATION_LIMIT = RateLimit(limit=3, window_seconds=3600)


def _origin(request: Request) -> str:
    """The caller's address, for hashing.

    `X-Forwarded-For`'s first entry, trusted only because this app is always
    deployed behind a proxy that sets it.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _check(
    request: Request, session: AsyncSession, settings: Settings, *, bucket: str, limit: RateLimit
) -> None:
    await RateLimiter(session).check(
        bucket=bucket,
        # A salted hash, never the address. The same rule as consent records:
        # an IP is personal data, and "we needed it to stop brute force" is not
        # a lawful basis for keeping one in the clear.
        key=hash_ip(_origin(request), salt=settings.ip_hash_salt),
        limit=limit,
    )


async def login_rate_limit(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_limiter_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    """Counted per origin, not per email.

    Per-email would be worse than useless here: an attacker spraying one password
    across ten thousand addresses never trips it, and anyone who knows a victim's
    address could lock them out on demand. Per-origin costs the attacker the
    thing that is actually scarce.
    """
    await _check(request, session, settings, bucket="auth.login", limit=LOGIN_LIMIT)


async def register_rate_limit(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_limiter_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    await _check(request, session, settings, bucket="auth.register", limit=REGISTER_LIMIT)


async def resend_verification_rate_limit(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_limiter_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    """Counted per origin, like the others.

    Per *account* would be the tempting key here, since the endpoint is
    authenticated - but it is the wrong scarce resource. One attacker with one
    account cannot mail-bomb anybody; one attacker with a thousand accounts can,
    and per-account counting would wave every one of them through.
    """
    await _check(
        request,
        session,
        settings,
        bucket="auth.resend_verification",
        limit=RESEND_VERIFICATION_LIMIT,
    )
