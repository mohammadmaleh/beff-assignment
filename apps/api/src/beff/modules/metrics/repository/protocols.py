"""What the metrics service needs from storage.

The aggregates are computed in SQL rather than by loading batches into Python.
A pilot line produces a few hundred batches a month, so either would work today
- but the shape that stops working first is the one that pulls rows across the
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

__all__ = [
    "BatchPoint",
    "BatchTotals",
    "MeasurementPoint",
    "MetricsRepository",
    "ScrapTotals",
]


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


@dataclass(frozen=True, slots=True)
class BatchPoint:
    """One batch, with its scrap already joined in.

    The batch is the unit of traceability (CONTEXT.md), so it is also the unit
    the trend is drawn in. Aggregating to calendar days instead would be wrong
    here rather than merely coarser: a batch is a run, two batches on one day are
    two independent yields, and averaging them hides exactly the batch-to-batch
    variation the chart exists to show.

    `cells_scrapped` and `committed_value_eur` come from the same round trip
    rather than a second query per batch - sixty batches would otherwise be
    sixty-one queries.
    """

    code: str
    started_at: datetime
    cells_started: int
    cells_passed: int
    cells_scrapped: int
    committed_value_eur: Decimal
    capacity_retention_pct: Decimal
    co2_intensity_kg_per_kwh: Decimal


@dataclass(frozen=True, slots=True)
class MeasurementPoint:
    """One reading, carrying the time it was taken and its window.

    The reading's own row has no timestamp that means anything to a chart - a
    `created_at` records when the row was written, not when the electrode was
    measured. The batch's `started_at` is the real x-coordinate, so it is joined
    on here rather than left for the service to look up per row.

    The limits travel with every point because they are stored per reading, not
    per parameter: a spec window changed in March must not retroactively
    reclassify a February measurement, and a control chart that drew one flat
    limit across the whole window would do exactly that.
    """

    parameter: str
    started_at: datetime
    value: Decimal
    lower_limit: Decimal
    upper_limit: Decimal
    target_value: Decimal | None
    unit: str


class MetricsRepository(Protocol):
    async def default_line(self, user_id: UUID) -> Line | None: ...

    async def batch_totals(self, line_id: int, start: datetime, end: datetime) -> BatchTotals: ...

    async def scrap_by_step(
        self, line_id: int, start: datetime, end: datetime
    ) -> list[ScrapTotals]: ...

    async def latest_measurements(self, line_id: int) -> list[ProcessMeasurement]: ...

    async def batch_series(
        self, line_id: int, start: datetime, end: datetime
    ) -> list[BatchPoint]: ...

    async def measurement_series(
        self, line_id: int, start: datetime, end: datetime
    ) -> list[MeasurementPoint]: ...
