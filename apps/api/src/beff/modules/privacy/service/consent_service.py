"""Consent, recorded as events rather than as a boolean."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from beff.core.security import hash_ip
from beff.db.base import utcnow
from beff.modules.privacy.errors import UnknownConsentPurposeError
from beff.modules.privacy.models import (
    CURRENT_POLICY_VERSION,
    MANAGEABLE_CONSENT_PURPOSES,
    ConsentRecord,
)
from beff.modules.privacy.repository import ConsentRepository

__all__ = ["ConsentService"]


class ConsentService:
    """Append-only consent.

    There is no `update` anywhere in this class, and that is the design. A
    boolean column that flips leaves no evidence of what was agreed to before,
    and Art. 7(1) puts the burden of *demonstrating* consent on the controller.
    So every grant and every withdrawal is a new row, and the current state is
    the newest row per purpose.
    """

    def __init__(
        self,
        records: ConsentRepository,
        *,
        ip_salt: str,
        clock: Callable[[], datetime] = utcnow,
    ) -> None:
        self._records = records
        self._ip_salt = ip_salt
        self._clock = clock

    async def state(self, user_id: UUID) -> dict[str, bool]:
        """Current consent per manageable purpose.

        Absent means not granted. Consent is never assumed from silence — that
        is the whole point of Art. 4(11)'s "unambiguous indication".
        """
        latest = await self._records.latest_per_purpose(user_id)
        return {
            purpose: latest[purpose].granted if purpose in latest else False
            for purpose in MANAGEABLE_CONSENT_PURPOSES
        }

    async def record(
        self,
        user_id: UUID,
        *,
        purpose: str,
        granted: bool,
        ip_address: str | None = None,
        country_code: str | None = None,
    ) -> dict[str, bool]:
        """Append a grant or a withdrawal, and return the new state.

        Withdrawal is the same operation as granting, with `granted=False`. That
        is not a shortcut — Art. 7(3) requires withdrawal to be as easy as
        giving, and a design where withdrawing takes a different code path is a
        design where it quietly becomes harder.
        """
        if purpose not in MANAGEABLE_CONSENT_PURPOSES:
            raise UnknownConsentPurposeError(purpose, MANAGEABLE_CONSENT_PURPOSES)

        await self._records.append(
            ConsentRecord(
                user_id=user_id,
                purpose=purpose,
                granted=granted,
                policy_version=CURRENT_POLICY_VERSION,
                recorded_at=self._clock(),
                # Salted hash, never the address itself. An IP is personal data,
                # and the only thing it is needed for is showing the data
                # subject that *an* origin was recorded.
                ip_hash=None if ip_address is None else hash_ip(ip_address, salt=self._ip_salt),
                # Country is the finest granularity stored anywhere in this
                # product. City-level geolocation would be a new purpose needing
                # its own legal basis.
                country_code=None if country_code is None else country_code.upper()[:2],
            )
        )
        return await self.state(user_id)
