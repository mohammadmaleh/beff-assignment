"""The failures the privacy module can produce."""

from __future__ import annotations

from beff.core.errors import DomainValidationError, NotFoundError

__all__ = ["ExportNotFoundError", "ExportNotReadyError", "UnknownConsentPurposeError"]


class UnknownConsentPurposeError(DomainValidationError):
    """A purpose outside the manageable set.

    Consent must be *specific* (Art. 4(11)), so the set is closed: a client
    cannot invent a purpose and have the record accepted as consent to it.
    """

    code = "privacy.unknown_consent_purpose"
    title = "Unknown consent purpose"

    def __init__(self, purpose: str, allowed: tuple[str, ...]) -> None:
        super().__init__(
            f"`{purpose}` is not a consent purpose this account can manage.",
            extra={"purpose": purpose, "allowed": list(allowed)},
        )


class ExportNotFoundError(NotFoundError):
    """No such export, or it belongs to someone else.

    One error for both, deliberately. Distinguishing "does not exist" from "not
    yours" would confirm the existence of another data subject's export to
    anyone who guessed an id.
    """

    code = "privacy.export_not_found"
    title = "Export not found"

    def __init__(self) -> None:
        super().__init__("No such export.")


class ExportNotReadyError(DomainValidationError):
    """The job exists but has not finished building."""

    code = "privacy.export_not_ready"
    title = "Export is not ready yet"

    def __init__(self, status: str) -> None:
        super().__init__(
            "That export is not ready to download yet.",
            extra={"status": status},
        )
