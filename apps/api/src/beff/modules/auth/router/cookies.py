"""The refresh cookie.

One place decides its name, path and flags, because a cookie set with one set of
attributes and cleared with another is not cleared at all — the browser treats
`(name, domain, path)` as the identity, and a mismatched `path` silently leaves
the old cookie in place.
"""

from __future__ import annotations

from fastapi import Response

from beff.core.config import Settings

__all__ = [
    "REFRESH_COOKIE_NAME",
    "REFRESH_COOKIE_PATH",
    "clear_refresh_cookie",
    "set_refresh_cookie",
]

REFRESH_COOKIE_NAME = "beff_refresh_token"

# Scoped to the auth endpoints. The cookie is only ever presented to `/refresh`
# and `/logout`, so sending it on every dashboard request would be pure
# additional exposure — and a wider CSRF surface — for no benefit.
REFRESH_COOKIE_PATH = "/api/v1/auth"


def set_refresh_cookie(response: Response, token: str, *, settings: Settings) -> None:
    """Attach the rotated refresh token.

    `httponly` is the load-bearing flag (ADR-0003): it is what puts the token
    out of reach of injected JavaScript, which is the entire reason the access
    token is kept in memory instead.

    `samesite="lax"` blocks the cookie on cross-site POSTs, which is what stops
    a third-party page from silently refreshing a session. `secure` is off
    outside production only because browsers drop `Secure` cookies over plain
    HTTP and local development would fail to log in with no visible cause.
    """
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        max_age=settings.refresh_token_ttl_seconds,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.cookies_require_https,
        samesite="lax",
    )


def clear_refresh_cookie(response: Response, *, settings: Settings) -> None:
    """Remove the refresh cookie.

    The attributes must match `set_refresh_cookie` exactly or the browser will
    keep the original.
    """
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.cookies_require_https,
        samesite="lax",
    )
