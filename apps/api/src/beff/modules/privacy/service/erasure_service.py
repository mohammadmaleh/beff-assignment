"""Art. 17 erasure, which is also the brief's mandated offboarding."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from beff.db.base import utcnow
from beff.modules.privacy.repository import ErasureRepository

__all__ = ["ErasureService"]


class ErasureService:
    """Delete the account and everything attached to it.

    The order below is not arbitrary. Sessions die first, so that a request
    already in flight cannot act on a half-erased account; exports die next,
    because an export is a complete copy of exactly what is being erased and
    leaving one behind makes the erasure cosmetic; consent records are
    pseudonymised rather than deleted, and the account row is soft-deleted last.
    """

    def __init__(
        self, repository: ErasureRepository, *, clock: Callable[[], datetime] = utcnow
    ) -> None:
        self._repository = repository
        self._clock = clock

    async def erase(self, user_id: UUID) -> None:
        now = self._clock()

        # A live session outliving the account it belongs to is the bug that
        # makes everything after this pointless.
        await self._repository.revoke_all_token_families(user_id, at=now)

        await self._repository.delete_export_jobs(user_id)

        # Before the account row is scrubbed, because both of these are keyed to
        # it. Verification tokens go first of the two and for a reason beyond
        # minimisation: an unconsumed one is a live credential for an address
        # that soft delete is about to free for re-registration, so leaving it
        # would let an old link act on somebody's new account.
        await self._repository.delete_verification_tokens(user_id)

        # Every delivery row holds the recipient address in the clear. There is
        # no accountability basis for keeping them the way there is for consent
        # records - nobody has to prove what we emailed someone - so these are
        # deleted rather than pseudonymised.
        await self._repository.delete_email_deliveries(user_id)

        # Kept, deliberately. Consent records are held on a different legal
        # basis from everything else here - Art. 6(1)(c), the accountability
        # obligation in Art. 7(1) - so erasing them would destroy the proof that
        # the processing which just ended was lawful. What is removed is the
        # ability to link them to a natural person: the IP hash and the country
        # code. Anonymised data leaves GDPR scope; this is the closest the
        # record can get while remaining evidence.
        await self._repository.pseudonymise_consent(user_id)

        # Soft delete, so the partial unique index (`WHERE deleted_at IS NULL`)
        # frees the email for re-registration while the row's foreign keys stay
        # intact. The identifying columns are scrubbed in the same statement -
        # a `deleted_at` that leaves the email readable is not erasure.
        await self._repository.soft_delete_user(user_id, at=now)
