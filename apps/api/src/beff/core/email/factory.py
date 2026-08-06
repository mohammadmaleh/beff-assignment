"""Choosing a transport from configuration.

One function, in one place, so "why did that email not go anywhere" has one
answer to check rather than a construction site in the worker and another in a
test helper.
"""

from __future__ import annotations

import structlog

from beff.core.config import Settings
from beff.core.email.sender import ConsoleEmailSender, EmailSender, SmtpEmailSender

__all__ = ["build_email_sender"]

log = structlog.get_logger(__name__)


def build_email_sender(settings: Settings) -> EmailSender:
    """SMTP when it is configured, the console when it is not.

    Falling back rather than failing is the deliberate half. An unconfigured
    deployment still boots, still registers users, and still queues their
    confirmations - and the warning below is what stops that being silent. The
    alternative, refusing to start, takes down everything else the API does
    because one feature is not wired yet.
    """
    if not settings.email_transport_configured:
        log.warning(
            "email.transport_not_configured",
            environment=settings.environment,
            detail=(
                "SMTP_HOST is unset. Messages will be logged instead of sent, "
                "and confirmation links will only be visible in the worker log."
            ),
        )
        return ConsoleEmailSender()

    return SmtpEmailSender(
        host=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_username,
        password=settings.smtp_password,
        sender=settings.email_from,
        start_tls=settings.smtp_starttls,
        use_ssl=settings.smtp_ssl,
    )
