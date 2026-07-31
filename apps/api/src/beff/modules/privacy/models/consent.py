"""The `consent_records` table — append-only proof of what was consented to.

GDPR Art. 7(1) puts the burden of proof on the controller: you must be able to
demonstrate that the data subject consented. A boolean column that gets
`UPDATE`d to `false` on withdrawal destroys exactly the evidence the article
asks for. So consent is an event log — granting and withdrawing are both new
rows — and the migration installs a trigger that rejects `UPDATE` and `DELETE`
outright, because a convention nobody can violate is worth more than one in a
code review checklist.
"""

from __future__ import annotations

from datetime import datetime
from typing import Final
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from beff.db.base import Base, sql_value_list, utcnow

__all__ = [
    "CONSENT_PURPOSES",
    "CURRENT_POLICY_VERSION",
    "MANAGEABLE_CONSENT_PURPOSES",
    "ConsentRecord",
]

# One purpose per record: consent must be *specific* (Art. 4(11)), so a single
# "I agree" covering analytics and marketing at once is not valid consent.
CONSENT_PURPOSES: Final = (
    "terms_of_service",
    "privacy_policy",
    "analytics",
    "marketing",
)

# The subset the data subject can turn on and off for themselves. Accepting the
# terms and the privacy policy are recorded at registration and are not
# withdrawable in isolation — withdrawing those is erasure, and it has its own
# endpoint. These two are what `GET /privacy/consent` reports on.
MANAGEABLE_CONSENT_PURPOSES: Final = ("analytics", "marketing")

# The version of the policy text a consent recorded today refers to.
#
# A constant rather than a setting: it is not environment-specific, it changes
# only when the published policy changes, and that change belongs in a commit
# next to the new text — not in an environment variable somebody can set to a
# version that was never published. `MANAGEABLE_CONSENT_PURPOSES` and the German
# and English policy pages in `apps/web` move together with it.
CURRENT_POLICY_VERSION: Final = "2026-01-01"

POLICY_VERSION_MAX_LENGTH: Final = 32
# SHA-256, hex-encoded.
IP_HASH_LENGTH: Final = 64


class ConsentRecord(Base):
    """A single consent event.

    Never exposed by id and appended to on every policy acceptance, so
    `BIGINT GENERATED ALWAYS AS IDENTITY` (ADR-0010).

    `ip_hash` is a salted SHA-256, never a raw IP: an IP address is personal
    data under GDPR, and the only thing it is needed for here is showing the
    data subject *that* an origin was recorded. `country_code` is deliberately
    the finest location granularity stored — city-level geolocation would be a
    new purpose requiring its own legal basis.
    """

    __tablename__ = "consent_records"
    __table_args__ = (
        CheckConstraint(f"purpose IN {sql_value_list(CONSENT_PURPOSES)}", name="purpose_allowed"),
        CheckConstraint(
            f"length(policy_version) <= {POLICY_VERSION_MAX_LENGTH}",
            name="policy_version_length",
        ),
        CheckConstraint("length(policy_version) > 0", name="policy_version_not_blank"),
        CheckConstraint(
            f"ip_hash IS NULL OR length(ip_hash) = {IP_HASH_LENGTH}",
            name="ip_hash_length",
        ),
        CheckConstraint(
            "country_code IS NULL OR country_code ~ '^[A-Z]{2}$'",
            name="country_code_iso_alpha2",
        ),
        Index("ix_consent_records_user_id", "user_id"),
        # "What is the current state of consent for purpose X" is
        # `ORDER BY recorded_at DESC LIMIT 1` over this index.
        Index(
            "ix_consent_records_user_id_purpose_recorded_at", "user_id", "purpose", "recorded_at"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)

    user_id: Mapped[UUID] = mapped_column(
        Uuid(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    purpose: Mapped[str] = mapped_column(Text(), nullable=False)

    # The event, not the state. `granted=false` is a withdrawal record.
    granted: Mapped[bool] = mapped_column(Boolean(), nullable=False)

    # Which text they agreed to. Without it the record proves nothing, because
    # the policy it refers to has since changed.
    policy_version: Mapped[str] = mapped_column(Text(), nullable=False)

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )

    ip_hash: Mapped[str | None] = mapped_column(Text(), nullable=True)
    country_code: Mapped[str | None] = mapped_column(Text(), nullable=True)
