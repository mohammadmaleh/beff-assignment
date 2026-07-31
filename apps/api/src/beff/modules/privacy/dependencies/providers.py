"""Wiring: session -> repositories -> services -> router."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from beff.core.config import Settings, get_settings
from beff.db import get_session
from beff.modules.privacy.repository import (
    PostgresConsentRepository,
    PostgresErasureRepository,
    PostgresExportRepository,
)
from beff.modules.privacy.service import (
    ConsentService,
    ErasureService,
    ExportService,
    PostgresExportBuilder,
)

__all__ = [
    "ConsentSvc",
    "ErasureSvc",
    "ExportSvc",
    "get_consent_service",
    "get_erasure_service",
    "get_export_service",
]


def get_consent_service(
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ConsentService:
    return ConsentService(PostgresConsentRepository(session), ip_salt=settings.ip_hash_salt)


def get_export_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ExportService:
    return ExportService(
        PostgresExportRepository(session),
        builder=PostgresExportBuilder(session),
    )


def get_erasure_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ErasureService:
    return ErasureService(PostgresErasureRepository(session))


ConsentSvc = Annotated[ConsentService, Depends(get_consent_service)]
ExportSvc = Annotated[ExportService, Depends(get_export_service)]
ErasureSvc = Annotated[ErasureService, Depends(get_erasure_service)]
