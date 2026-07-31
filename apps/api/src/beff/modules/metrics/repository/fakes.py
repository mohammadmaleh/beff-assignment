"""In-memory metrics repository.

Ships beside the PostgreSQL implementation so mypy checks both against the same
`Protocol`, and so the service's arithmetic — which is where the interesting
mistakes live — can be tested without a database.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from beff.modules.metrics.models import ProcessMeasurement
from beff.modules.metrics.repository.protocols import BatchTotals, ScrapTotals
from beff.modules.onboarding.models import Line

__all__ = ["InMemoryMetricsRepository"]

EMPTY = BatchTotals(
    cells_started=0,
    cells_passed=0,
    capacity_retention_pct=None,
    co2_intensity_kg_per_kwh=None,
)


class InMemoryMetricsRepository:
    """Canned aggregates, keyed by the window they belong to."""

    def __init__(
        self,
        *,
        line: Line | None = None,
        totals: dict[tuple[datetime, datetime], BatchTotals] | None = None,
        scrap: dict[tuple[datetime, datetime], list[ScrapTotals]] | None = None,
        measurements: list[ProcessMeasurement] | None = None,
    ) -> None:
        self.line = line
        self.totals = totals or {}
        self.scrap = scrap or {}
        self.measurements = measurements or []
        # Recorded so a test can assert the two windows are adjacent and do not
        # overlap. An off-by-one there silently corrupts every delta on the
        # dashboard, and no assertion on the numbers alone would catch it.
        self.windows: list[tuple[datetime, datetime]] = []

    async def default_line(self, user_id: UUID) -> Line | None:
        return self.line

    async def batch_totals(self, line_id: int, start: datetime, end: datetime) -> BatchTotals:
        self.windows.append((start, end))
        return self.totals.get((start, end), EMPTY)

    async def scrap_by_step(
        self,
        line_id: int,
        start: datetime,
        end: datetime,
    ) -> list[ScrapTotals]:
        return self.scrap.get((start, end), [])

    async def latest_measurements(self, line_id: int) -> list[ProcessMeasurement]:
        return self.measurements


def totals(started: int, passed: int, retention: str = "88.0", co2: str = "61.5") -> BatchTotals:
    """Terse constructor for test fixtures."""
    return BatchTotals(
        cells_started=started,
        cells_passed=passed,
        capacity_retention_pct=Decimal(retention),
        co2_intensity_kg_per_kwh=Decimal(co2),
    )
