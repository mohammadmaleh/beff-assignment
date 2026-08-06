"""The `waitlist_entries` table - pre-launch signups from the landing page.

A waitlist entry is **not** a user (CONTEXT.md, "Waitlist entry"). There is no
account, no password and no session; there is a person who asked to be told when
the product opens. The legal basis is consent - they typed their address into a
form whose label says what it is for - so the row records which version of that
text they saw.

Never exposed by id and written at whatever rate the landing page attracts, so
`BIGINT GENERATED ALWAYS AS IDENTITY` (ADR-0010).

Note what is *not* here: no IP hash, no country code. Art. 5(1)(c) data
minimisation - the form submission is itself the record of consent, and an
origin hash would be additional personal data collected for no stated purpose.
The consent log has one because a consent record has to be defensible years
later against a claim that it was never given; a waitlist signup does not.
"""

from __future__ import annotations

from typing import Final

from sqlalchemy import BigInteger, CheckConstraint, Identity, Index, Text
from sqlalchemy.orm import Mapped, mapped_column

from beff.db.base import Base, TimestampMixin

__all__ = [
    "COMPANY_MAX_LENGTH",
    "EMAIL_MAX_LENGTH",
    "WAITLIST_POLICY_VERSION",
    "WaitlistEntry",
]

# RFC 5321 caps a forward path at 254 octets.
EMAIL_MAX_LENGTH: Final = 254
COMPANY_MAX_LENGTH: Final = 160
POLICY_VERSION_MAX_LENGTH: Final = 32

# The version of the landing-page privacy notice a signup today consented to.
WAITLIST_POLICY_VERSION: Final = "2026-01-01"


class WaitlistEntry(TimestampMixin, Base):
    """One pre-launch signup.

    `email` is uniquely indexed outright, not partially: nothing here is soft
    deleted, because there is nothing to preserve referential integrity *for*.
    An unsubscribe is a `DELETE`, and after it the address is free again.
    """

    __tablename__ = "waitlist_entries"
    __table_args__ = (
        CheckConstraint(f"length(email) <= {EMAIL_MAX_LENGTH}", name="email_length"),
        CheckConstraint("length(email) > 0", name="email_not_blank"),
        CheckConstraint(f"length(company) <= {COMPANY_MAX_LENGTH}", name="company_length"),
        CheckConstraint("length(company) > 0", name="company_not_blank"),
        CheckConstraint(
            f"length(policy_version) <= {POLICY_VERSION_MAX_LENGTH}",
            name="policy_version_length",
        ),
        CheckConstraint("length(policy_version) > 0", name="policy_version_not_blank"),
        Index("uq_waitlist_entries_email", "email", unique=True),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)

    # Stored already case-folded - the unique index compares raw bytes, so
    # `Ada@X` and `ada@x` would otherwise be two entries for one person.
    email: Mapped[str] = mapped_column(Text(), nullable=False)

    company: Mapped[str] = mapped_column(Text(), nullable=False)

    policy_version: Mapped[str] = mapped_column(Text(), nullable=False)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<WaitlistEntry id={self.id} company={self.company!r}>"
