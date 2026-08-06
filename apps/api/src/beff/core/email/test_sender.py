"""Transports, and the MIME they produce."""

from __future__ import annotations

import pytest

from beff.core.email.message import EmailMessage
from beff.core.email.sender import (
    ConsoleEmailSender,
    PermanentEmailError,
    RecordingEmailSender,
    SmtpEmailSender,
    build_mime,
)

MESSAGE = EmailMessage(
    to="ada@example.test",
    subject="Confirm your email address",
    text="Follow the link.",
    html="<p>Follow the link.</p>",
)


def test_mime_carries_the_addresses_and_subject() -> None:
    mime = build_mime(MESSAGE, sender="Beff <no-reply@beff.test>")

    assert mime["From"] == "Beff <no-reply@beff.test>"
    assert mime["To"] == "ada@example.test"
    assert mime["Subject"] == "Confirm your email address"


def test_mime_puts_the_text_part_before_the_html_part() -> None:
    """The order is the standard's, not a preference.

    A client picks the *last* part it understands, so text first and HTML second
    is what makes a rich client show the HTML and a plain one show the text. The
    other order silently downgrades every reader.
    """
    mime = build_mime(MESSAGE, sender="beff@test")

    subtypes = [part.get_content_subtype() for part in mime.iter_parts()]
    assert subtypes == ["plain", "html"]


def test_a_message_with_no_html_stays_a_single_part() -> None:
    """An HTML-only email is the shape bulk senders use and filters know it.

    The inverse also matters: wrapping a text-only message in
    `multipart/alternative` with one part is a malformed-looking message for no
    gain.
    """
    mime = build_mime(EmailMessage(to="a@b.test", subject="s", text="t"), sender="beff@test")

    assert not mime.is_multipart()
    assert mime.get_content_type() == "text/plain"


def test_the_text_part_survives_a_non_ascii_body() -> None:
    """German is a shipped locale, so every message has umlauts in it.

    A transport that mangles them produces a message that is technically
    delivered and unreadable, which no delivery-status check would catch.
    """
    mime = build_mime(
        EmailMessage(to="a@b.test", subject="Bestätigen", text="Grüße, schön"),
        sender="beff@test",
    )

    assert mime.get_content().strip() == "Grüße, schön"


async def test_the_recorder_keeps_every_message() -> None:
    sender = RecordingEmailSender()

    await sender.send(MESSAGE)
    await sender.send(MESSAGE)

    assert len(sender.sent) == 2
    assert sender.sent[0].to == "ada@example.test"


async def test_the_recorder_can_be_told_to_fail() -> None:
    """The delivery service's retry and dead-letter paths need a failing
    transport, and this is how a unit test gets one without a socket."""
    sender = RecordingEmailSender(fail_with=PermanentEmailError("550 no such user"))

    with pytest.raises(PermanentEmailError):
        await sender.send(MESSAGE)

    assert sender.sent == []


async def test_the_console_sender_accepts_anything() -> None:
    """What `docker compose up` runs on. It must never raise — a local stack
    that fails registration because mail is unconfigured is a broken stack."""
    await ConsoleEmailSender().send(MESSAGE)


async def test_smtp_maps_a_refused_recipient_to_a_permanent_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Retrying a refused address burns the attempt budget to learn nothing.

    The distinction is the whole reason `PermanentEmailError` exists: 4xx is
    "try later" and is what the retries are for; a refusal is not.
    """
    import aiosmtplib

    async def refuse(*_: object, **__: object) -> None:
        raise aiosmtplib.SMTPRecipientsRefused([])

    monkeypatch.setattr(aiosmtplib, "send", refuse)

    sender = SmtpEmailSender(host="smtp.test", port=587, sender="beff@test")

    with pytest.raises(PermanentEmailError):
        await sender.send(MESSAGE)


async def test_smtp_maps_a_5xx_response_to_a_permanent_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import aiosmtplib

    async def refuse(*_: object, **__: object) -> None:
        raise aiosmtplib.SMTPResponseException(550, "mailbox unavailable")

    monkeypatch.setattr(aiosmtplib, "send", refuse)

    sender = SmtpEmailSender(host="smtp.test", port=587, sender="beff@test")

    with pytest.raises(PermanentEmailError):
        await sender.send(MESSAGE)


async def test_smtp_lets_a_4xx_response_through_as_retryable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A 421 is "come back later" and must stay retryable.

    Classifying it as permanent would dead-letter every message sent during a
    provider's rate-limit window — the exact moment a queue is supposed to help.
    """
    import aiosmtplib

    async def defer(*_: object, **__: object) -> None:
        raise aiosmtplib.SMTPResponseException(421, "service not available")

    monkeypatch.setattr(aiosmtplib, "send", defer)

    sender = SmtpEmailSender(host="smtp.test", port=587, sender="beff@test")

    with pytest.raises(aiosmtplib.SMTPResponseException):
        await sender.send(MESSAGE)


async def test_smtp_never_asks_for_starttls_and_implicit_tls_together(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """aiosmtplib raises on the combination rather than picking one.

    Port 465 wants implicit TLS and 587 wants STARTTLS. Someone setting
    `SMTP_SSL=true` while `SMTP_STARTTLS` keeps its default of true would
    otherwise get a `ValueError` from inside the library, on every message,
    reported as a transient failure and retried three times.
    """
    import aiosmtplib

    captured: dict[str, object] = {}

    async def capture(*_: object, **kwargs: object) -> None:
        captured.update(kwargs)

    monkeypatch.setattr(aiosmtplib, "send", capture)

    sender = SmtpEmailSender(
        host="smtp.test", port=465, sender="beff@test", start_tls=True, use_ssl=True
    )
    await sender.send(MESSAGE)

    assert captured["use_tls"] is True
    assert captured["start_tls"] is False


async def test_smtp_sends_no_credentials_when_none_are_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Empty strings are not credentials.

    Passing `username=""` makes aiosmtplib attempt an AUTH with a blank user,
    which some servers reject outright — so a local relay that needs no auth
    would fail for a reason that reads as a configuration typo.
    """
    import aiosmtplib

    captured: dict[str, object] = {}

    async def capture(*_: object, **kwargs: object) -> None:
        captured.update(kwargs)

    monkeypatch.setattr(aiosmtplib, "send", capture)

    await SmtpEmailSender(host="smtp.test", port=25, sender="beff@test").send(MESSAGE)

    assert captured["username"] is None
    assert captured["password"] is None
