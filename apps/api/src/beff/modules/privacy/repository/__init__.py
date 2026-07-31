"""Data access for the privacy module."""

from beff.modules.privacy.repository.fakes import (
    InMemoryConsentRepository,
    InMemoryErasureRepository,
    InMemoryExportRepository,
)
from beff.modules.privacy.repository.postgres import (
    PostgresConsentRepository,
    PostgresErasureRepository,
    PostgresExportRepository,
)
from beff.modules.privacy.repository.protocols import (
    ConsentRepository,
    ErasureRepository,
    ExportRepository,
)

__all__ = [
    "ConsentRepository",
    "ErasureRepository",
    "ExportRepository",
    "InMemoryConsentRepository",
    "InMemoryErasureRepository",
    "InMemoryExportRepository",
    "PostgresConsentRepository",
    "PostgresErasureRepository",
    "PostgresExportRepository",
]
