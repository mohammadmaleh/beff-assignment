"""Choosing a transport from configuration."""

from __future__ import annotations

from beff.core.config import Settings
from beff.core.email.factory import build_email_sender
from beff.core.email.sender import ConsoleEmailSender, SmtpEmailSender


def test_no_smtp_host_falls_back_to_the_console() -> None:
    """An unconfigured deployment still boots and still queues confirmations.

    Refusing to start would take down everything else the API does because one
    feature is not wired yet — and locally it is the *normal* state.
    """
    sender = build_email_sender(Settings(smtp_host=""))

    assert isinstance(sender, ConsoleEmailSender)


def test_whitespace_is_not_a_host() -> None:
    """A `SMTP_HOST=" "` in an env file would otherwise be treated as configured
    and produce a connection error on every message instead of a warning once."""
    sender = build_email_sender(Settings(smtp_host="   "))

    assert isinstance(sender, ConsoleEmailSender)


def test_a_configured_host_gets_the_smtp_transport() -> None:
    sender = build_email_sender(Settings(smtp_host="smtp.example.test"))

    assert isinstance(sender, SmtpEmailSender)
