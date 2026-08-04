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
from beff.modules.metrics.repository.protocols import (
    BatchPoint,
    BatchTotals,
    MeasurementPoint,
    ScrapTotals,
)
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
        series: list[BatchPoint] | None = None,
        measurement_points: list[MeasurementPoint] | None = None,
    ) -> None:
        self.line = line
        self.totals = totals or {}
        self.scrap = scrap or {}
        self.measurements = measurements or []
        self.series = series or []
        self.measurement_points = measurement_points or []
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

    async def batch_series(self, line_id: int, start: datetime, end: datetime) -> list[BatchPoint]:
        """Filtered and sorted, rather than returned whole.

        The other fakes hand back a canned list keyed on the window. This one
        applies the window itself, half-open and oldest-first, because those are
        exactly the two things the SQL does that a test can otherwise not see —
        a fake that ignores `start` and `end` will happily pass a service that
        asks for the wrong window.
        """
        return sorted(
            (point for point in self.series if start <= point.started_at < end),
            key=lambda point: point.started_at,
        )

    async def measurement_series(
        self, line_id: int, start: datetime, end: datetime
    ) -> list[MeasurementPoint]:
        return sorted(
            (point for point in self.measurement_points if start <= point.started_at < end),
            key=lambda point: (point.started_at, point.parameter),
        )


def point(
    code: str,
    started_at: datetime,
    started: int,
    passed: int,
    *,
    committed: str = "0",
    retention: str = "88.0",
    co2: str = "61.5",
) -> BatchPoint:
    """Terse constructor for a batch on the trend.

    `cells_scrapped` is derived rather than passed, because on a real row it is
    not independent: every cell that started and did not pass was scrapped
    somewhere. A fixture free to set the three numbers separately can express a
    batch the database cannot hold, and a test built on one proves nothing.
    """
    return BatchPoint(
        code=code,
        started_at=started_at,
        cells_started=started,
        cells_passed=passed,
        cells_scrapped=started - passed,
        committed_value_eur=Decimal(committed),
        capacity_retention_pct=Decimal(retention),
        co2_intensity_kg_per_kwh=Decimal(co2),
    )


def reading(
    parameter: str,
    started_at: datetime,
    value: str,
    *,
    lower: str = "30.0",
    upper: str = "35.0",
    target: str | None = "32.5",
    unit: str = "%",
) -> MeasurementPoint:
    """Terse constructor for a point on a control chart."""
    return MeasurementPoint(
        parameter=parameter,
        started_at=started_at,
        value=Decimal(value),
        lower_limit=Decimal(lower),
        upper_limit=Decimal(upper),
        target_value=None if target is None else Decimal(target),
        unit=unit,
    )


def totals(started: int, passed: int, retention: str = "88.0", co2: str = "61.5") -> BatchTotals:
    """Terse constructor for test fixtures."""
    return BatchTotals(
        cells_started=started,
        cells_passed=passed,
        capacity_retention_pct=Decimal(retention),
        co2_intensity_kg_per_kwh=Decimal(co2),
    )
