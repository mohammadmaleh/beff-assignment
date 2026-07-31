"""PostgreSQL implementation of the metrics repository."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from beff.modules.metrics.models import Batch, ProcessMeasurement, ScrapEvent
from beff.modules.metrics.repository.protocols import BatchTotals, ScrapTotals
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

        The window is half-open — `start <= started_at < end` — so a batch never
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
        by decision (ADR-0001 — the app is not portable across engines and does
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
