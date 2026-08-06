"""The verification message, in the reader's language.

Copy lives here rather than in `core/email` because `core/email` is a transport
and knows nothing about what is being sent. It lives on the *backend* rather
than in the web app because nothing in the browser is involved in sending it -
the frontend never sees this text.

Both locales are required. German is a shipped locale, not a fallback, and this
project has already sent a German-speaking user an English string once by
letting a default exist. There is no default here: `render` takes a locale and
`_COPY` has an entry for every value the type allows, so a new locale is a type
error rather than an English paragraph in a German inbox.
"""

from __future__ import annotations

from typing import Final, Literal
from urllib.parse import quote

from beff.core.email.message import EmailMessage

__all__ = ["EMAIL_LOCALES", "EmailLocale", "render_verification_email", "verification_url"]

EmailLocale = Literal["en", "de"]

EMAIL_LOCALES: Final[tuple[EmailLocale, ...]] = ("en", "de")

# One entry per member of `EmailLocale`. Adding a locale to the type without
# adding it here is caught by `test_verification.py`, which iterates the type's
# own members rather than a hand-written list.
_COPY: Final[dict[EmailLocale, dict[str, str]]] = {
    "en": {
        "subject": "Confirm your email address",
        "greeting": "Hello {name},",
        "lead": (
            "Someone - we hope you - created a Beff account with this address. "
            "Confirm it to finish setting up."
        ),
        "cta": "Confirm this address",
        "fallback": "If the button does not work, paste this link into your browser:",
        "expiry": "The link stops working in {hours} hours.",
        "ignore": (
            "If you did not create this account, you can ignore this message. "
            "Nothing was set up in your name."
        ),
        "signoff": "- Beff",
    },
    "de": {
        "subject": "Bestätigen Sie Ihre E-Mail-Adresse",
        "greeting": "Hallo {name},",
        "lead": (
            "Jemand - hoffentlich Sie - hat mit dieser Adresse ein Beff-Konto erstellt. "
            "Bestätigen Sie die Adresse, um die Einrichtung abzuschließen."
        ),
        "cta": "Diese Adresse bestätigen",
        "fallback": (
            "Falls die Schaltfläche nicht funktioniert, fügen Sie diesen Link in Ihren Browser ein:"
        ),
        "expiry": "Der Link ist {hours} Stunden gültig.",
        "ignore": (
            "Wenn Sie dieses Konto nicht erstellt haben, können Sie diese Nachricht "
            "ignorieren. In Ihrem Namen wurde nichts eingerichtet."
        ),
        "signoff": "- Ihr Beff-Team",
    },
}


def verification_url(*, base_url: str, token: str, locale: EmailLocale) -> str:
    """The link the message carries.

    The token goes in the query string, not the path, so the landing route is a
    single static page rather than a dynamic segment - and `quote` is not
    decoration: the token is URL-safe base64, whose alphabet includes `-` and
    `_` but whose *generator* is not this function's business to assume.
    """
    return f"{base_url.rstrip('/')}/{locale}/verify-email?token={quote(token, safe='')}"


def _escape(value: str) -> str:
    """Minimal HTML escaping for the interpolated parts.

    A display name is user-supplied and goes into the HTML part. `html.escape`
    would do, but the quote handling differs between attribute and text context
    and only text context occurs here - being explicit is cheaper than being
    subtly wrong later.
    """
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_verification_email(
    *,
    to: str,
    display_name: str,
    token: str,
    base_url: str,
    locale: EmailLocale,
    ttl_seconds: int,
) -> EmailMessage:
    """Render the message. Pure - no clock, no I/O, no settings object."""
    copy = _COPY[locale]
    url = verification_url(base_url=base_url, token=token, locale=locale)
    hours = max(1, ttl_seconds // 3600)

    greeting = copy["greeting"].format(name=display_name)
    expiry = copy["expiry"].format(hours=hours)

    text = "\n\n".join(
        [
            greeting,
            copy["lead"],
            url,
            expiry,
            copy["ignore"],
            copy["signoff"],
        ]
    )

    html = (
        f"<p>{_escape(greeting)}</p>"
        f"<p>{_escape(copy['lead'])}</p>"
        f'<p><a href="{_escape(url)}">{_escape(copy["cta"])}</a></p>'
        f"<p>{_escape(copy['fallback'])}<br>{_escape(url)}</p>"
        f"<p>{_escape(expiry)}</p>"
        f"<p>{_escape(copy['ignore'])}</p>"
        f"<p>{_escape(copy['signoff'])}</p>"
    )

    return EmailMessage(to=to, subject=copy["subject"], text=text, html=html)
