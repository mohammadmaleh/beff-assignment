"""The message a sender is asked to deliver.

A plain value object, deliberately free of any notion of *why* it is being
sent. The verification mail, and every mail after it, is rendered to this shape
before it reaches a transport — so the transport has no opinion about the
product and the product has no opinion about SMTP.
"""

from __future__ import annotations

from dataclasses import dataclass

__all__ = ["EmailMessage"]


@dataclass(frozen=True, slots=True)
class EmailMessage:
    """One outbound email.

    `text` is required and `html` is not. A text part is what makes the message
    readable in a client that refuses HTML and is what keeps it out of a spam
    folder; an HTML-only email is the shape bulk senders use, and filters treat
    it accordingly.
    """

    to: str
    subject: str
    text: str
    html: str | None = None
