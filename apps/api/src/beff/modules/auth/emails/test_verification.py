"""The verification message.

The rule this file enforces is the one the project learned the expensive way: a
perceivable string must never have a language chosen for it by default. German
is a shipped locale, and a German-speaking user receiving an English email is
invisible to every automated check — a well-formed string in the wrong language
passes linting, passes schema validation, and renders perfectly.
"""

from __future__ import annotations

from typing import get_args

import pytest

from beff.core.email.message import EmailMessage
from beff.modules.auth.emails.verification import (
    EMAIL_LOCALES,
    EmailLocale,
    render_verification_email,
    verification_url,
)

TOKEN = "a-token-value"
BASE = "https://beff.test"


def _render(locale: EmailLocale = "en", **overrides: object) -> EmailMessage:
    kwargs: dict[str, object] = {
        "to": "ada@example.test",
        "display_name": "Ada",
        "token": TOKEN,
        "base_url": BASE,
        "locale": locale,
        "ttl_seconds": 86400,
    }
    kwargs.update(overrides)
    return render_verification_email(**kwargs)  # type: ignore[arg-type]


def test_every_locale_in_the_type_has_copy() -> None:
    """The list and the type must not drift.

    Iterating the `Literal`'s own members rather than a hand-written list is
    what makes adding a locale to the type without adding copy a test failure
    rather than a `KeyError` in production, in one language, for some users.
    """
    assert set(get_args(EmailLocale)) == set(EMAIL_LOCALES)


@pytest.mark.parametrize("locale", EMAIL_LOCALES)
def test_every_locale_renders(locale: EmailLocale) -> None:
    message = _render(locale)

    assert message.subject
    assert message.text
    assert message.html


def test_the_german_subject_is_german() -> None:
    """Pinned to the actual string, not merely "different from English".

    A gate that only asserts the two differ would bless any typo, and the
    failure mode being guarded against here is precisely a plausible-looking
    string nobody read.
    """
    assert _render("de").subject == "Bestätigen Sie Ihre E-Mail-Adresse"


def test_the_german_body_contains_no_english_sentences() -> None:
    """The specific regression: an English default leaking into a German mail.

    These words are unambiguous — none is a German word, and none appears in a
    URL or an address — so a hit means English prose reached a German reader.
    """
    text = _render("de").text.lower()

    for english_only in ("hello", "confirm this address", "you can ignore", "the link stops"):
        assert english_only not in text


@pytest.mark.parametrize("locale", EMAIL_LOCALES)
def test_the_link_is_in_the_text_part(locale: EmailLocale) -> None:
    """Not only the HTML. A reader whose client refuses HTML must still be able
    to confirm, and that reader is exactly the security-conscious one."""
    message = _render(locale)

    assert verification_url(base_url=BASE, token=TOKEN, locale=locale) in message.text


def test_the_link_carries_the_readers_locale() -> None:
    """So the landing page continues in the language the email was written in.

    Switching to English on click would undo the whole point of rendering the
    message in German.
    """
    assert verification_url(base_url=BASE, token=TOKEN, locale="de").startswith(
        "https://beff.test/de/verify-email"
    )


def test_the_token_is_url_encoded() -> None:
    """A token is opaque bytes as far as this function is concerned.

    Interpolating one raw would break the link for any value containing a
    character with meaning in a query string — silently, and only for some
    users, since the alphabet is random per token.
    """
    url = verification_url(base_url=BASE, token="a b&c=d", locale="en")

    assert "a%20b%26c%3Dd" in url
    assert "&c=" not in url


def test_a_trailing_slash_on_the_base_url_does_not_double() -> None:
    """`APP_BASE_URL` is set by hand in a deployment, and both forms get typed."""
    url = verification_url(base_url="https://beff.test/", token=TOKEN, locale="en")

    assert "//verify" not in url
    assert url.startswith("https://beff.test/en/verify-email")


def test_the_expiry_is_stated_in_hours() -> None:
    assert "24" in _render("en", ttl_seconds=86400).text


def test_a_sub_hour_expiry_never_reads_as_zero_hours() -> None:
    """`ttl // 3600` is 0 for anything under an hour, and "the link stops
    working in 0 hours" is worse than saying nothing."""
    assert "0 hours" not in _render("en", ttl_seconds=600).text


def test_a_display_name_cannot_inject_markup_into_the_html_part() -> None:
    """The name is user-supplied and goes into an HTML body.

    Not a stored-XSS risk in a mail client the way it would be in a browser, but
    it is a phishing vector: an attacker who can put a working `<a>` into a
    message that genuinely comes from us has borrowed our domain's reputation.
    """
    message = _render("en", display_name='<a href="https://evil.test">Ada</a>')
    assert message.html is not None

    # The one anchor the message is *allowed* to contain is its own CTA. Strip
    # it before asserting, or this test passes on the presence of the link it
    # was supposed to be checking around.
    cta = f'<a href="{verification_url(base_url=BASE, token=TOKEN, locale="en")}"'
    assert "<a href=" not in message.html.replace(cta, "")
    assert "&lt;a href=" in message.html


def test_the_recipient_is_the_address_given() -> None:
    assert _render().to == "ada@example.test"
