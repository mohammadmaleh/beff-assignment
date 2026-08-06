"""Message copy owned by the auth module."""

from beff.modules.auth.emails.verification import (
    EMAIL_LOCALES,
    EmailLocale,
    render_verification_email,
    verification_url,
)

__all__ = [
    "EMAIL_LOCALES",
    "EmailLocale",
    "render_verification_email",
    "verification_url",
]
