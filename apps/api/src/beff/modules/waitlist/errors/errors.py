"""The failures the waitlist can produce."""

from __future__ import annotations

from beff.core.errors import ConflictError

__all__ = ["AlreadyOnWaitlistError"]


class AlreadyOnWaitlistError(ConflictError):
    """That address is already signed up.

    This does leak that an address is on the list, and unlike the login form
    that is acceptable: a waitlist is a marketing surface, the "account" it
    reveals confers nothing, and the alternative — silently pretending to add a
    duplicate — leaves the person unable to tell whether they signed up.
    """

    code = "waitlist.already_registered"
    title = "Already on the waiting list"

    def __init__(self) -> None:
        super().__init__("That address is already on the waiting list.")
