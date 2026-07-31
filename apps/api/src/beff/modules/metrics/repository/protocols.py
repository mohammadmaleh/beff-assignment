"""What the metrics service needs from storage.

The aggregates are computed in SQL rather than by loading batches into Python.
A pilot line produces a few hundred batches a month, so either would work today
— but the shape that stops working first is the one that pulls rows across the
wire to sum them, and moving it later means moving it under load.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Protocol
from uuid import UUID

from beff.modules.metrics.models import ProcessMeasurement
from beff.modules.onboarding.models import Line

__all__ = ["BatchTotals", "MetricsRepository", "ScrapTotals"]


@dataclass(frozen=True, slots=True)
class BatchTotals:
    """Summed over a window. Averages are `None` when the window has no batches."""

    cells_started: int
    cells_passed: int
    capacity_retention_pct: Decimal | None
    co2_intensity_kg_per_kwh: Decimal | None


@dataclass(frozen=True, slots=True)
class ScrapTotals:
    process_step: str
    cells_scrapped: int
    committed_value_eur: Decimal


class MetricsRepository(Protocol):
    async def default_line(self, user_id: UUID) -> Line | None: ...

    async def batch_totals(self, line_id: int, start: datetime, end: datetime) -> BatchTotals: ...

    async def scrap_by_step(
        self, line_id: int, start: datetime, end: datetime
    ) -> list[ScrapTotals]: ...

    async def latest_measurements(self, line_id: int) -> list[ProcessMeasurement]: ...
