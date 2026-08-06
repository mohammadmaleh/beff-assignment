"""Which language the confirmation email is written in."""

from __future__ import annotations

import pytest

from beff.modules.auth.dependencies.locale import (
    FALLBACK_EMAIL_LOCALE,
    negotiate_email_locale,
    resolve_email_locale,
)


def test_no_header_negotiates_nothing() -> None:
    """`None`, not a fallback. The caller needs to tell "we speak none of what
    you asked for" apart from "you asked for English"."""
    assert negotiate_email_locale(None) is None
    assert negotiate_email_locale("") is None


def test_a_plain_tag_is_matched() -> None:
    assert negotiate_email_locale("de") == "de"


def test_a_regional_tag_matches_its_language() -> None:
    """`de-AT` and `de-CH` are German. The subtag says which German, and this
    product has one — refusing to match would send an Austrian user English."""
    assert negotiate_email_locale("de-AT") == "de"
    assert negotiate_email_locale("de-CH,de;q=0.9") == "de"


def test_quality_values_decide_the_winner() -> None:
    """The header is a preference list, not an ordered one — a client can and
    does write its favourite second."""
    assert negotiate_email_locale("en;q=0.3, de;q=0.9") == "de"
    assert negotiate_email_locale("de;q=0.2, en;q=0.8") == "en"


def test_an_unweighted_tag_beats_a_weighted_one() -> None:
    """An absent `q` means 1.0, which is the maximum. Defaulting it to anything
    lower would make `Accept-Language: de, en;q=0.9` resolve to English."""
    assert negotiate_email_locale("de, en;q=0.9") == "de"


def test_equal_quality_keeps_the_clients_own_order() -> None:
    assert negotiate_email_locale("de, en") == "de"
    assert negotiate_email_locale("en, de") == "en"


def test_unsupported_languages_are_skipped_rather_than_matched() -> None:
    """Real browsers send long lists. Matching the first entry blindly would
    return French, which this product does not have copy for — and a `KeyError`
    at render time is a 500 on registration."""
    assert negotiate_email_locale("fr-FR,fr;q=0.9,es;q=0.8") is None
    assert negotiate_email_locale("fr-FR,fr;q=0.9,de;q=0.8") == "de"


def test_an_explicit_refusal_is_honoured() -> None:
    """`q=0` means "not this one". Treating it as a weak preference would send a
    message in the one language the client said it could not read."""
    assert negotiate_email_locale("de;q=0, en;q=0.5") == "en"
    assert negotiate_email_locale("de;q=0") is None


def test_a_malformed_quality_does_not_discard_the_whole_header() -> None:
    """A header this app did not write and cannot fix should degrade, not fail.
    Raising here would turn a strange browser into a failed registration."""
    assert negotiate_email_locale("de;q=banana") == "de"


def test_whitespace_and_case_are_tolerated() -> None:
    assert negotiate_email_locale("  DE-de ;q=0.9 ") == "de"


def test_an_explicit_request_beats_the_header() -> None:
    """The frontend knows which locale the user is reading the site in, and that
    is better evidence than a browser preference set years ago."""
    assert resolve_email_locale("en", accept_language="de") == "en"


def test_the_header_is_used_when_nothing_was_requested() -> None:
    assert resolve_email_locale(None, accept_language="de-AT,de;q=0.9") == "de"


def test_english_is_the_last_resort() -> None:
    """One guess, in one place, where it can be seen — rather than a default
    sitting on a schema field where nobody reads it."""
    assert resolve_email_locale(None, accept_language=None) == FALLBACK_EMAIL_LOCALE
    assert resolve_email_locale(None, accept_language="fr") == FALLBACK_EMAIL_LOCALE


@pytest.mark.parametrize("header", ["", ",", ";q=0.9", "de;;;", "-"])
def test_degenerate_headers_never_raise(header: str) -> None:
    """Whatever comes back, registration must not 500 on a header."""
    negotiate_email_locale(header)
