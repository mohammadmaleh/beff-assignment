"""Pre-launch signups."""

from __future__ import annotations

from beff.modules.waitlist.errors import AlreadyOnWaitlistError
from beff.modules.waitlist.models import WAITLIST_POLICY_VERSION, WaitlistEntry
from beff.modules.waitlist.repository import WaitlistRepository

__all__ = ["WaitlistService"]


class WaitlistService:
    """Joining the waiting list.

    A waitlist entry is **not a user** (CONTEXT.md). It carries no credentials
    and confers no access, which is why it lives in its own module with its own
    table rather than as a `users` row in some pending state - a half-user is
    the kind of thing that eventually gets a login.

    The legal basis is consent (Art. 6(1)(a)), so the policy version travels
    with the row: the address was given against a specific text, and without
    recording which one, the record proves nothing later.
    """

    def __init__(self, entries: WaitlistRepository) -> None:
        self._entries = entries

    async def join(self, *, email: str, company: str) -> WaitlistEntry:
        normalised = self._normalise_email(email)

        if await self._entries.get_by_email(normalised) is not None:
            # A courtesy that produces a good error message; the unique index is
            # what actually holds under two concurrent submissions.
            raise AlreadyOnWaitlistError

        return await self._entries.add(
            WaitlistEntry(
                email=normalised,
                company=company.strip(),
                policy_version=WAITLIST_POLICY_VERSION,
            )
        )

    @staticmethod
    def _normalise_email(email: str) -> str:
        """Fold case and trim. The unique index compares raw bytes, so without
        this `Ada@X` and `ada@x` are two entries for one person."""
        return email.strip().lower()
