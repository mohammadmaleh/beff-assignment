"""Privacy module — consent, DSARs and erasure.

Currently exposes the append-only consent log only; DSAR export and erasure
arrive with their own issues.
"""

from beff.modules.privacy.models import CONSENT_PURPOSES, ConsentRecord

__all__ = ["CONSENT_PURPOSES", "ConsentRecord"]
