"""The failures the metrics module can produce."""

from __future__ import annotations

from beff.core.errors import DomainValidationError

__all__ = ["NoLineConfiguredError"]


class NoLineConfiguredError(DomainValidationError):
    """The account has no production line yet.

    Distinct from "a line that produced nothing". Returning zeros for an account
    that has not finished onboarding would render as a line running 0% yield,
    which is alarming and false; this code tells the client to send the user
    back to the wizard instead.
    """

    code = "metrics.no_line_configured"
    title = "No production line yet"

    def __init__(self) -> None:
        super().__init__("This account has no production line configured yet.")
