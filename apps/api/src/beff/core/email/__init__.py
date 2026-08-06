"""Outbound email: a transport, a transactional outbox, and the worker's half.

Nothing in here knows what a battery cell is or what an account is for. The
product decides *what* to say (`modules/auth/emails`); this decides how it gets
out of the building, and how it is retried when it does not.
"""

from beff.core.email.factory import build_email_sender
from beff.core.email.message import EmailMessage
from beff.core.email.model import (
    DEFAULT_MAX_ATTEMPTS,
    EMAIL_DELIVERY_STATUSES,
    TERMINAL_EMAIL_DELIVERY_STATUSES,
    EmailDelivery,
)
from beff.core.email.outbox import EmailOutbox, InMemoryEmailOutbox, PostgresEmailOutbox
from beff.core.email.sender import (
    ConsoleEmailSender,
    EmailSender,
    PermanentEmailError,
    RecordingEmailSender,
    SmtpEmailSender,
    build_mime,
)
from beff.core.email.service import EmailDeliveryService

__all__ = [
    "DEFAULT_MAX_ATTEMPTS",
    "EMAIL_DELIVERY_STATUSES",
    "TERMINAL_EMAIL_DELIVERY_STATUSES",
    "ConsoleEmailSender",
    "EmailDelivery",
    "EmailDeliveryService",
    "EmailMessage",
    "EmailOutbox",
    "EmailSender",
    "InMemoryEmailOutbox",
    "PermanentEmailError",
    "PostgresEmailOutbox",
    "RecordingEmailSender",
    "SmtpEmailSender",
    "build_email_sender",
    "build_mime",
]
