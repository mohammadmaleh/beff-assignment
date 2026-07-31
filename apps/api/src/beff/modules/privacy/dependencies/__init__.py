"""Privacy wiring."""

from beff.modules.privacy.dependencies.providers import (
    ConsentSvc,
    ErasureSvc,
    ExportSvc,
    get_consent_service,
    get_erasure_service,
    get_export_service,
)

__all__ = [
    "ConsentSvc",
    "ErasureSvc",
    "ExportSvc",
    "get_consent_service",
    "get_erasure_service",
    "get_export_service",
]
