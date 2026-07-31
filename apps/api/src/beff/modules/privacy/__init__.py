"""Privacy — consent, data export and erasure.

Three GDPR features rather than the two the brief asks for, because erasure
doubles as the mandated offboarding flow.

The rules that shape this module, each of which has a test:

- **Consent records are append-only.** Never `UPDATE` a boolean — you must be
  able to prove what was consented to, when, and against which policy version.
- **Never store a raw IP.** Salted hash plus a country code, never city-level.
- **Exports exclude password hashes and any third party's data.**
- **Background jobs are idempotent.** At-least-once delivery means retries
  happen; permanent failures are not retried.

Public API of the module. `main.py` wires what this barrel exports.
"""

from beff.modules.privacy.models import (
    CONSENT_PURPOSES,
    ConsentRecord,
    DsarRequest,
    ExportJob,
)
from beff.modules.privacy.router import router as privacy_router

__all__ = [
    "CONSENT_PURPOSES",
    "ConsentRecord",
    "DsarRequest",
    "ExportJob",
    "privacy_router",
]
