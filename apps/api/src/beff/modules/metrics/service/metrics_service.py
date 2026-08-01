"""What the dashboard shows, computed from batches.

Every figure here is derived. Nothing is stored pre-aggregated, because the
window is a parameter and a stored rollup for "last 30 days" is wrong the moment
the definition of "now" moves.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID

from beff.db.base import utcnow
from beff.modules.metrics.errors import NoLineConfiguredError
from beff.modules.metrics.models import PROCESS_STEPS
from beff.modules.metrics.repository import MetricsRepository

__all__ = ["MetricsOverview", "MetricsService", "ScrapByStep", "SpecBandReading"]

DEFAULT_WINDOW_DAYS = 30


@dataclass(frozen=True, slots=True)
class ScrapByStep:
    process_step: str
    scrap_rate_pct: float
    committed_value_eur: float


@dataclass(frozen=True, slots=True)
class SpecBandReading:
    parameter: str
    value: float
    lower_limit: float
    upper_limit: float
    target: float | None
    unit: str


@dataclass(frozen=True, slots=True)
class MetricsOverview:
    line_name: str
    line_kind: str
    window_days: int
    first_pass_yield_pct: float
    first_pass_yield_delta_pp: float
    scrap_rate_pct: float
    scrap_rate_delta_pp: float
    capacity_retention_pct: float
    co2_intensity_kg_per_kwh: float
    scrap_by_step: list[ScrapByStep] = field(default_factory=list)
    spec_bands: list[SpecBandReading] = field(default_factory=list)


def _pct(part: int, whole: int) -> float:
    """Percentage, 0-100, defined as zero on an empty denominator.

    A line that started no cells has no yield — not a division by zero, and not
    100%. Reporting 100% for "no data" is the single most misleading default a
    dashboard can pick.
    """
    return 0.0 if whole == 0 else round((part / whole) * 100, 2)


def _avg(value: Decimal | None) -> float:
    """A SQL `AVG` rounded to two places, defaulting to zero.

    `AVG` over `NUMERIC` returns full precision, so an unrounded conversion puts
    `88.3248275862069` in the payload. The frontend would format that down to
    one decimal and look fine, which is exactly why it is worth fixing here
    instead: the same value goes into the data-table alternative and into the
    GDPR export, where it is read as-is and implies a precision the instrument
    never had.
    """
    return 0.0 if value is None else round(float(value), 2)


class MetricsService:
    """Aggregation. Knows nothing about HTTP or SQL."""

    def __init__(
        self, repository: MetricsRepository, *, clock: Callable[[], datetime] = utcnow
    ) -> None:
        self._repository = repository
        # Injected for the same reason `AuthService` injects one: every window
        # boundary here is derived from "now", so a test that cannot pin it is a
        # test whose fixtures drift between two calls in the same function.
        self._clock = clock

    async def overview(
        self, user_id: UUID, *, window_days: int = DEFAULT_WINDOW_DAYS
    ) -> MetricsOverview:
        """Headline figures, the scrap breakdown, and the tolerance bands.

        The deltas compare the window against the window immediately before it,
        so "up 1.4 pp" means against the previous 30 days rather than against
        some fixed baseline that ages.
        """
        line = await self._repository.default_line(user_id)
        if line is None:
            # Not an empty dashboard: an account with no line has not finished
            # onboarding, and the client sends the user back there. Returning
            # zeros would look like a line that produced nothing.
            raise NoLineConfiguredError

        now = self._clock()
        window_start = now - timedelta(days=window_days)
        previous_start = window_start - timedelta(days=window_days)

        current = await self._repository.batch_totals(line.id, window_start, now)
        previous = await self._repository.batch_totals(line.id, previous_start, window_start)

        fpy = _pct(current.cells_passed, current.cells_started)
        previous_fpy = _pct(previous.cells_passed, previous.cells_started)

        scrap_rows = await self._repository.scrap_by_step(line.id, window_start, now)
        scrapped_now = sum(row.cells_scrapped for row in scrap_rows)
        scrap_rate = _pct(scrapped_now, current.cells_started)

        previous_scrap_rows = await self._repository.scrap_by_step(
            line.id, previous_start, window_start
        )
        previous_scrap_rate = _pct(
            sum(row.cells_scrapped for row in previous_scrap_rows), previous.cells_started
        )

        by_step = {row.process_step: row for row in scrap_rows}
        breakdown = [
            ScrapByStep(
                process_step=step,
                scrap_rate_pct=_pct(by_step[step].cells_scrapped, current.cells_started),
                committed_value_eur=float(by_step[step].committed_value_eur),
            )
            # Iterated in canonical process order rather than in whatever order
            # the query returned, and steps with no scrap are omitted rather
            # than shown as a zero-length bar.
            for step in PROCESS_STEPS
            if step in by_step
        ]

        measurements = await self._repository.latest_measurements(line.id)

        return MetricsOverview(
            line_name=line.name,
            line_kind="pilot" if line.is_pilot_line else "production",
            window_days=window_days,
            first_pass_yield_pct=fpy,
            first_pass_yield_delta_pp=round(fpy - previous_fpy, 2),
            scrap_rate_pct=scrap_rate,
            scrap_rate_delta_pp=round(scrap_rate - previous_scrap_rate, 2),
            capacity_retention_pct=_avg(current.capacity_retention_pct),
            co2_intensity_kg_per_kwh=_avg(current.co2_intensity_kg_per_kwh),
            scrap_by_step=breakdown,
            spec_bands=[
                SpecBandReading(
                    parameter=row.parameter,
                    value=float(row.value),
                    lower_limit=float(row.lower_limit),
                    upper_limit=float(row.upper_limit),
                    target=None if row.target_value is None else float(row.target_value),
                    unit=row.unit,
                )
                for row in measurements
            ],
        )
