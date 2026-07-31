"""Wiring: session -> repository -> service -> router."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from beff.db import get_session
from beff.modules.metrics.repository import PostgresMetricsRepository
from beff.modules.metrics.service import MetricsService

__all__ = ["Service", "get_metrics_service"]


def get_metrics_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> MetricsService:
    return MetricsService(PostgresMetricsRepository(session))


Service = Annotated[MetricsService, Depends(get_metrics_service)]
