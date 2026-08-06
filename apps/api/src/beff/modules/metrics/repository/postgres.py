"""PostgreSQL implementation of the metrics repository."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from beff.modules.metrics.models import Batch, ProcessMeasurement, ScrapEvent
from beff.modules.metrics.repository.protocols import (
    BatchPoint,
    BatchTotals,
    MeasurementPoint,
    ScrapTotals,
)
from beff.modules.onboarding.models import Line, Plant

__all__ = ["PostgresMetricsRepository"]


class PostgresMetricsRepository:
    """Satisfies `MetricsRepository` structurally."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def default_line(self, user_id: UUID) -> Line | None:
        result = await self._session.execute(
            select(Line)
            .join(Plant, Line.plant_id == Plant.id)
            .where(Plant.user_id == user_id)
            .order_by(Line.id)
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def batch_totals(self, line_id: int, start: datetime, end: datetime) -> BatchTotals:
        """Sums and averages over the window, in one round trip.

        The window is half-open - `start <= started_at < end` - so a batch never
        lands in both the current period and the one it is compared against.
        A closed interval double-counts on the boundary and makes a delta of
        exactly zero look like drift.
        """
        result = await self._session.execute(
            select(
                func.coalesce(func.sum(Batch.cells_started), 0),
                func.coalesce(func.sum(Batch.cells_passed_eol), 0),
                func.avg(Batch.capacity_retention_pct),
                func.avg(Batch.co2_intensity_kg_per_kwh),
            ).where(
                Batch.line_id == line_id,
                Batch.started_at >= start,
                Batch.started_at < end,
            )
        )
        started, passed, retention, co2 = result.one()
        return BatchTotals(
            cells_started=int(started),
            cells_passed=int(passed),
            capacity_retention_pct=None if retention is None else Decimal(retention),
            co2_intensity_kg_per_kwh=None if co2 is None else Decimal(co2),
        )

    async def scrap_by_step(
        self, line_id: int, start: datetime, end: datetime
    ) -> list[ScrapTotals]:
        result = await self._session.execute(
            select(
                ScrapEvent.process_step,
                func.coalesce(func.sum(ScrapEvent.cells_scrapped), 0),
                func.coalesce(func.sum(ScrapEvent.committed_value_eur), 0),
            )
            .join(Batch, ScrapEvent.batch_id == Batch.id)
            .where(
                Batch.line_id == line_id,
                Batch.started_at >= start,
                Batch.started_at < end,
            )
            .group_by(ScrapEvent.process_step)
        )
        return [
            ScrapTotals(
                process_step=step,
                cells_scrapped=int(cells),
                committed_value_eur=Decimal(value),
            )
            for step, cells, value in result.all()
        ]

    async def latest_measurements(self, line_id: int) -> list[ProcessMeasurement]:
        """The most recent reading per parameter.

        `DISTINCT ON` rather than a correlated subquery or a window function
        filtered in Python: it is the one construct that expresses "newest row
        per group" in a single index-ordered scan, and this is PostgreSQL-only
        by decision (ADR-0001 - the app is not portable across engines and does
        not pretend to be).
        """
        newest: Select[tuple[ProcessMeasurement]] = (
            select(ProcessMeasurement)
            .join(Batch, ProcessMeasurement.batch_id == Batch.id)
            .where(Batch.line_id == line_id)
            .distinct(ProcessMeasurement.parameter)
            .order_by(ProcessMeasurement.parameter, Batch.started_at.desc())
        )
        result = await self._session.execute(newest)
        return list(result.scalars().all())

    async def batch_series(self, line_id: int, start: datetime, end: datetime) -> list[BatchPoint]:
        """Every batch in the window, oldest first, with its scrap totalled.

        A `LEFT OUTER JOIN` onto the aggregated scrap, not an inner one: a batch
        that scrapped nothing is a 100% first-pass yield and the single most
        interesting point on the chart. An inner join drops it, and the trend
        line then silently omits its own best days.

        The scrap is aggregated in a subquery rather than joined row-wise
        because `ScrapEvent` is one row per process step - joining directly
        would multiply each batch by twelve and every `cells_started` sum in
        this query would be twelve times too large.
        """
        scrap = (
            select(
                ScrapEvent.batch_id.label("batch_id"),
                func.coalesce(func.sum(ScrapEvent.cells_scrapped), 0).label("cells_scrapped"),
                func.coalesce(func.sum(ScrapEvent.committed_value_eur), 0).label("committed"),
            )
            .group_by(ScrapEvent.batch_id)
            .subquery()
        )

        result = await self._session.execute(
            select(
                Batch.code,
                Batch.started_at,
                Batch.cells_started,
                Batch.cells_passed_eol,
                func.coalesce(scrap.c.cells_scrapped, 0),
                func.coalesce(scrap.c.committed, 0),
                Batch.capacity_retention_pct,
                Batch.co2_intensity_kg_per_kwh,
            )
            .outerjoin(scrap, scrap.c.batch_id == Batch.id)
            .where(
                Batch.line_id == line_id,
                Batch.started_at >= start,
                Batch.started_at < end,
            )
            # Oldest first. The chart reads left to right and sorting in the
            # client would be a second place the order is decided.
            .order_by(Batch.started_at)
        )
        return [
            BatchPoint(
                code=code,
                started_at=started_at,
                cells_started=int(cells_started),
                cells_passed=int(cells_passed),
                cells_scrapped=int(cells_scrapped),
                committed_value_eur=Decimal(committed),
                capacity_retention_pct=Decimal(retention),
                co2_intensity_kg_per_kwh=Decimal(co2),
            )
            for (
                code,
                started_at,
                cells_started,
                cells_passed,
                cells_scrapped,
                committed,
                retention,
                co2,
            ) in result.all()
        ]

    async def measurement_series(
        self, line_id: int, start: datetime, end: datetime
    ) -> list[MeasurementPoint]:
        """Every reading in the window, oldest batch first.

        The batch's `started_at` is selected alongside the reading because that
        is the reading's real x-coordinate - `process_measurements.created_at`
        records when the row was written, which on a seeded or back-filled
        dataset is the same instant for every row and would collapse the whole
        chart onto one tick.

        Ordered by batch time then parameter so the service can group without
        re-sorting, and so two parameters on one batch keep a stable order
        between requests.
        """
        result = await self._session.execute(
            select(
                ProcessMeasurement.parameter,
                Batch.started_at,
                ProcessMeasurement.value,
                ProcessMeasurement.lower_limit,
                ProcessMeasurement.upper_limit,
                ProcessMeasurement.target_value,
                ProcessMeasurement.unit,
            )
            .join(Batch, ProcessMeasurement.batch_id == Batch.id)
            .where(
                Batch.line_id == line_id,
                Batch.started_at >= start,
                Batch.started_at < end,
            )
            .order_by(Batch.started_at, ProcessMeasurement.parameter)
        )
        return [
            MeasurementPoint(
                parameter=parameter,
                started_at=started_at,
                value=value,
                lower_limit=lower,
                upper_limit=upper,
                target_value=target,
                unit=unit,
            )
            for parameter, started_at, value, lower, upper, target, unit in result.all()
        ]
