"""Assembling the export document.

What is in here matters more than how it is built. Two exclusions are absolute:

- **No password hash.** It is a credential, not personal data the subject needs,
  and handing one out turns a portability request into an offline cracking
  target.
- **No third party's data.** Art. 15(4) is explicit that the right to a copy
  must not adversely affect the rights of others.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from beff.core.email.model import EmailDelivery
from beff.db.base import utcnow
from beff.modules.auth.models import User
from beff.modules.onboarding.models import Line, OnboardingProgress, Plant
from beff.modules.privacy.models import ConsentRecord

__all__ = ["EXPORT_FORMAT_VERSION", "PostgresExportBuilder"]

EXPORT_FORMAT_VERSION = "1.0"


def _json_safe(value: object) -> Any:
    """Make a value representable in JSON without losing precision silently."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal):
        # As a string, not a float. A yield percentage that arrives as
        # 72.39999999999999 in someone else's system is a portability failure.
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    return value


class PostgresExportBuilder:
    """Satisfies `ExportBuilder` structurally."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def build(self, user_id: UUID) -> dict[str, Any]:
        user = (
            await self._session.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()
        if user is None:
            # Not retryable: the account is gone, and no number of attempts will
            # bring it back.
            from beff.modules.privacy.service.export_service import PermanentExportError

            raise PermanentExportError(f"No such user: {user_id!s}")

        consent = (
            (
                await self._session.execute(
                    select(ConsentRecord)
                    .where(ConsentRecord.user_id == user_id)
                    .order_by(ConsentRecord.recorded_at)
                )
            )
            .scalars()
            .all()
        )

        deliveries = (
            (
                await self._session.execute(
                    select(EmailDelivery)
                    .where(EmailDelivery.user_id == user_id)
                    .order_by(EmailDelivery.queued_at)
                )
            )
            .scalars()
            .all()
        )

        progress = (
            await self._session.execute(
                select(OnboardingProgress).where(OnboardingProgress.user_id == user_id)
            )
        ).scalar_one_or_none()

        plants = (
            (await self._session.execute(select(Plant).where(Plant.user_id == user_id)))
            .scalars()
            .all()
        )

        lines = (
            (
                await self._session.execute(
                    select(Line)
                    .join(Plant, Line.plant_id == Plant.id)
                    .where(Plant.user_id == user_id)
                )
            )
            .scalars()
            .all()
        )

        return {
            "format_version": EXPORT_FORMAT_VERSION,
            "generated_at": utcnow().isoformat(),
            # Named so a recipient system knows what it is looking at without
            # guessing from the shape - Art. 20 says machine-readable, and
            # "machine-readable" includes being self-describing.
            "subject": {
                "id": str(user.id),
                "email": user.email,
                "display_name": user.display_name,
                "role": user.role,
                "created_at": _json_safe(user.created_at),
                "email_verified_at": _json_safe(user.email_verified_at),
                # `password_hash` is deliberately absent. See the module
                # docstring; there is a test that fails if it appears.
            },
            # What we sent them, and when. Personal data we hold about the
            # subject under Art. 15(1) - and the part of it they are least
            # likely to be able to reconstruct themselves, since a message that
            # never arrived leaves no trace on their side.
            #
            # The bodies are excluded: they are our copy for the subject's own
            # mail, and a verification body contains a link that, while spent,
            # is still a credential shape nobody needs re-published into an
            # export file. Subject and status answer the question that gets
            # asked, which is "did you email me and did it work".
            "email_deliveries": [
                {
                    "purpose": delivery.purpose,
                    "subject": delivery.subject,
                    "status": delivery.status,
                    "queued_at": _json_safe(delivery.queued_at),
                    "completed_at": _json_safe(delivery.completed_at),
                }
                for delivery in deliveries
            ],
            "consent_records": [
                {
                    "purpose": record.purpose,
                    "granted": record.granted,
                    "policy_version": record.policy_version,
                    "recorded_at": _json_safe(record.recorded_at),
                    "country_code": record.country_code,
                    # `ip_hash` is deliberately absent: it is a pseudonym we
                    # hold for accountability, not information about the
                    # subject, and it cannot be reversed for them anyway.
                }
                for record in consent
            ],
            "onboarding": None
            if progress is None
            else {
                "current_step": progress.current_step,
                "answers": progress.answers,
                "completed_at": _json_safe(progress.completed_at),
            },
            "plants": [
                {"name": plant.name, "country_code": plant.country_code} for plant in plants
            ],
            "lines": [
                {
                    "name": line.name,
                    "cell_format": line.cell_format,
                    "is_pilot_line": line.is_pilot_line,
                }
                for line in lines
            ],
        }
