"""Which language the confirmation email is written in.

An HTTP concern, so it lives with the other dependencies rather than beside the
copy. The rule is: what the client explicitly asked for, else what its
`Accept-Language` says, else English - and the last step is the only guess,
taken once, in one place, where it can be seen.
"""

from __future__ import annotations

from beff.modules.auth.emails import EMAIL_LOCALES, EmailLocale

__all__ = ["FALLBACK_EMAIL_LOCALE", "negotiate_email_locale", "resolve_email_locale"]

FALLBACK_EMAIL_LOCALE: EmailLocale = "en"


def negotiate_email_locale(accept_language: str | None) -> EmailLocale | None:
    """Pick a supported locale from an `Accept-Language` header.

    Deliberately simple: the header is parsed for quality values and the highest
    weighted *supported* tag wins. A full RFC 4647 lookup would add wildcards
    and ranges for a two-locale product - `de-AT` matching `de` is the only
    subtlety that actually occurs, and the prefix split below is exactly that.

    Returns `None` rather than a fallback, so the caller can tell "the header
    named nothing we speak" apart from "the header named English".
    """
    if not accept_language:
        return None

    ranked: list[tuple[float, int, EmailLocale]] = []
    for position, part in enumerate(accept_language.split(",")):
        token = part.strip()
        if not token:
            continue

        tag, _, params = token.partition(";")
        tag = tag.strip().lower()

        quality = 1.0
        for param in params.split(";"):
            key, _, value = param.strip().partition("=")
            if key.strip() == "q":
                try:
                    quality = float(value)
                except ValueError:
                    # A malformed q is not a reason to reject the whole header.
                    # Treat the tag as unweighted and let the others rank.
                    quality = 1.0

        if quality <= 0:
            # `q=0` means "explicitly not this one", which is a refusal, not a
            # weak preference.
            continue

        # `de-AT` and `de-CH` are German. The subtag says which German, and this
        # product has one.
        primary = tag.split("-")[0]
        if primary in EMAIL_LOCALES:
            # No cast needed: mypy narrows `str` to the Literal through
            # membership in a tuple of literals, so the runtime check and the
            # static type agree without being told to.
            #
            # Position breaks ties, so equal-quality tags keep the order the
            # client wrote them in.
            ranked.append((quality, -position, primary))

    if not ranked:
        return None
    return max(ranked)[2]


def resolve_email_locale(
    requested: EmailLocale | None, *, accept_language: str | None
) -> EmailLocale:
    """The locale to render in. Explicit beats negotiated beats English."""
    if requested is not None:
        return requested
    return negotiate_email_locale(accept_language) or FALLBACK_EMAIL_LOCALE
