"""Transports. One protocol, three implementations, no product knowledge.

The protocol is what the delivery worker depends on, so a unit test hands it a
recorder and never opens a socket, and `docker compose up` runs the console
sender and never needs a mail account.
"""

from __future__ import annotations

from email.message import EmailMessage as MimeMessage
from typing import Protocol

import structlog

from beff.core.email.message import EmailMessage

__all__ = [
    "ConsoleEmailSender",
    "EmailSender",
    "PermanentEmailError",
    "RecordingEmailSender",
    "SmtpEmailSender",
    "build_mime",
]

log = structlog.get_logger(__name__)


class PermanentEmailError(Exception):
    """A failure retrying cannot fix - a malformed address, a rejected sender.

    Mirrors `PermanentExportError`. Retrying a 550 burns the attempt budget and
    delays the dead-letter path by exactly as long as the backoff; the retries
    exist for the dropped connection, not for the refusal.
    """


class EmailSender(Protocol):
    """Anything that can put a message on its way."""

    async def send(self, message: EmailMessage) -> None: ...


def build_mime(message: EmailMessage, *, sender: str) -> MimeMessage:
    """Render to MIME.

    Shared by the SMTP sender and its tests, which is the point: a test that
    asserts on the headers must assert on the *same* headers the transport
    emits, not on a second rendering that can drift from it.
    """
    mime = MimeMessage()
    mime["From"] = sender
    mime["To"] = message.to
    mime["Subject"] = message.subject
    mime.set_content(message.text)
    if message.html is not None:
        # `add_alternative` after `set_content` is what produces
        # `multipart/alternative` with the text part first, which is the order
        # the standard specifies: least-rich first, so a client picks the best
        # part it understands by reading to the end.
        mime.add_alternative(message.html, subtype="html")
    return mime


class SmtpEmailSender:
    """Delivers over SMTP. Satisfies `EmailSender` structurally.

    No vendor SDK. Every transactional provider on offer speaks SMTP, so
    changing provider is four environment variables and no code - and nothing
    in this file has to be re-tested when that happens.
    """

    def __init__(
        self,
        *,
        host: str,
        port: int,
        username: str = "",
        password: str = "",
        sender: str,
        start_tls: bool = True,
        use_ssl: bool = False,
        timeout: float = 15.0,
    ) -> None:
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._sender = sender
        self._start_tls = start_tls
        self._use_ssl = use_ssl
        self._timeout = timeout

    async def send(self, message: EmailMessage) -> None:
        # Imported here rather than at module scope so that importing the app -
        # or collecting the unit suite - does not require the dependency to be
        # installed for a transport nothing in that path uses.
        import aiosmtplib

        mime = build_mime(message, sender=self._sender)

        try:
            await aiosmtplib.send(
                mime,
                hostname=self._host,
                port=self._port,
                username=self._username or None,
                password=self._password or None,
                # Mutually exclusive: implicit TLS wraps the whole connection,
                # STARTTLS upgrades a plaintext one. Asking for both makes
                # aiosmtplib raise rather than pick.
                start_tls=self._start_tls and not self._use_ssl,
                use_tls=self._use_ssl,
                timeout=self._timeout,
            )
        except aiosmtplib.SMTPRecipientsRefused as exc:
            # The address does not exist, or the server will not accept it.
            # Three more attempts produce three more refusals.
            raise PermanentEmailError(str(exc)) from exc
        except aiosmtplib.SMTPResponseException as exc:
            # 5xx is a permanent refusal; 4xx is "try later" and is exactly what
            # the retry budget is for.
            if 500 <= exc.code < 600:
                raise PermanentEmailError(f"{exc.code} {exc.message}") from exc
            raise


class ConsoleEmailSender:
    """Logs the message instead of sending it. Satisfies `EmailSender`.

    What `docker compose up` runs on, and what an unconfigured deployment falls
    back to. The verification link is printed in full and on purpose - without
    it, a local stack cannot complete the flow it is running, and the developer
    goes looking for a bug in the token instead of in their SMTP settings.
    """

    async def send(self, message: EmailMessage) -> None:
        log.info(
            "email.console",
            to=message.to,
            subject=message.subject,
            body=message.text,
        )


class RecordingEmailSender:
    """Keeps every message in a list. Satisfies `EmailSender`.

    Ships in `src/` rather than a test tree for the same reason the in-memory
    repositories do: it is part of the contract that makes the delivery service
    testable, and mypy checks it against the same protocol as the real
    transport, so a change to `send` cannot leave it behind.
    """

    def __init__(self, *, fail_with: Exception | None = None) -> None:
        self.sent: list[EmailMessage] = []
        self._fail_with = fail_with

    async def send(self, message: EmailMessage) -> None:
        if self._fail_with is not None:
            raise self._fail_with
        self.sent.append(message)
