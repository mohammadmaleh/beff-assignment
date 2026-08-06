"""What the dashboard shows, computed from batches.

Every figure here is derived. Nothing is stored pre-aggregated, because the
window is a parameter and a stored rollup for "last 30 days" is wrong the moment
the definition of "now" moves.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID

from beff.db.base import utcnow
from beff.modules.metrics.benchmark import CohortReference, cohort_for
from beff.modules.metrics.errors import NoLineConfiguredError
from beff.modules.metrics.models import PROCESS_STEPS
from beff.modules.metrics.repository import MeasurementPoint, MetricsRepository

__all__ = [
    "MetricsOverview",
    "MetricsService",
    "MetricsTrend",
    "ParameterPoint",
    "ParameterSeries",
    "ScrapByStep",
    "SpecBandReading",
    "TrendPoint",
]

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


@dataclass(frozen=True, slots=True)
class TrendPoint:
    """One batch on the trend charts.

    Carries both the derived rates and the raw counts they came from. That is
    not redundancy: the yield chart plots the rate, the throughput chart plots
    the counts, and the tooltip shows "812 of 1 140 cells" - which is the form a
    process engineer actually reasons in. Recomputing counts from a rounded
    percentage on the client would give 811.
    """

    batch_code: str
    started_at: datetime
    cells_started: int
    cells_passed: int
    cells_scrapped: int
    first_pass_yield_pct: float
    scrap_rate_pct: float
    capacity_retention_pct: float
    co2_intensity_kg_per_kwh: float
    committed_value_lost_eur: float


@dataclass(frozen=True, slots=True)
class ParameterPoint:
    started_at: datetime
    value: float


@dataclass(frozen=True, slots=True)
class ParameterSeries:
    """A process parameter over time, with the limits it is judged against."""

    parameter: str
    unit: str
    lower_limit: float
    upper_limit: float
    target: float | None
    points: list[ParameterPoint] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class MetricsTrend:
    """Everything the charts are drawn from, in one request.

    Deliberately a second endpoint rather than more fields on the overview. The
    overview is four numbers and twelve rows and answers "how bad, and where";
    this is sixty batches and their measurements and answers "since when". They
    have different sizes, different natural cache lifetimes, and the overview is
    what the page needs to render its first useful pixel - putting the series in
    front of it would make the headline wait on data it does not use.
    """

    line_name: str
    line_kind: str
    window_days: int
    total_cells_started: int
    total_cells_passed: int
    total_cells_scrapped: int
    total_committed_value_lost_eur: float
    window_first_pass_yield_pct: float
    best_batch_code: str | None
    worst_batch_code: str | None
    benchmark: CohortReference
    points: list[TrendPoint] = field(default_factory=list)
    parameters: list[ParameterSeries] = field(default_factory=list)


def _pct(part: int, whole: int) -> float:
    """Percentage, 0-100, defined as zero on an empty denominator.

    A line that started no cells has no yield - not a division by zero, and not
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


def _group_parameters(readings: Iterable[MeasurementPoint]) -> list[ParameterSeries]:
    """One series per parameter, each with the limits currently in force.

    The limits are taken from the **newest** reading in the series, not the
    first. They are stored per reading precisely so that changing a spec window
    does not reclassify history - which means a window spanning a spec change
    holds two sets. The chart draws one pair of lines, and the pair it must draw
    is the one in force now; using the oldest would report today's in-spec
    readings as failures.
    """
    grouped: dict[str, list[MeasurementPoint]] = defaultdict(list)
    for row in readings:
        grouped[row.parameter].append(row)

    series = []
    # Sorted by name so the charts keep a stable order between requests. The
    # repository orders by time first, which is right for the points and says
    # nothing useful about which parameter comes first on screen.
    for parameter in sorted(grouped):
        rows = sorted(grouped[parameter], key=lambda row: row.started_at)
        current = rows[-1]
        series.append(
            ParameterSeries(
                parameter=parameter,
                unit=current.unit,
                lower_limit=float(current.lower_limit),
                upper_limit=float(current.upper_limit),
                target=None if current.target_value is None else float(current.target_value),
                points=[
                    ParameterPoint(started_at=row.started_at, value=float(row.value))
                    for row in rows
                ],
            )
        )
    return series


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

    async def trend(self, user_id: UUID, *, window_days: int = DEFAULT_WINDOW_DAYS) -> MetricsTrend:
        """The batch-by-batch series behind the charts.

        Batch-by-batch rather than day-by-day. The batch is the unit of
        traceability (CONTEXT.md), and it is also the unit an engineer can act
        on - "B-2026-041 went wrong" is a thing to go and investigate, whereas
        "the 14th went wrong" is not, because two batches on one day are two
        independent runs and averaging them hides the variation the chart exists
        to show.
        """
        line = await self._repository.default_line(user_id)
        if line is None:
            # Same precondition as `overview`. The dashboard fires both calls in
            # parallel; if only one raised, an account mid-onboarding would get
            # a half-rendered screen instead of being sent back to the wizard.
            raise NoLineConfiguredError

        now = self._clock()
        window_start = now - timedelta(days=window_days)
        line_kind = "pilot" if line.is_pilot_line else "production"

        batches = await self._repository.batch_series(line.id, window_start, now)

        points = [
            TrendPoint(
                batch_code=batch.code,
                started_at=batch.started_at,
                cells_started=batch.cells_started,
                cells_passed=batch.cells_passed,
                cells_scrapped=batch.cells_scrapped,
                first_pass_yield_pct=_pct(batch.cells_passed, batch.cells_started),
                # Against cells *started*, the same denominator the yield uses,
                # so the pair sums to 100 for every batch. Against cells
                # scrapped-plus-passed it would look almost identical and be
                # subtly wrong on any batch still in progress.
                scrap_rate_pct=_pct(batch.cells_scrapped, batch.cells_started),
                capacity_retention_pct=float(batch.capacity_retention_pct),
                co2_intensity_kg_per_kwh=float(batch.co2_intensity_kg_per_kwh),
                committed_value_lost_eur=float(batch.committed_value_eur),
            )
            for batch in batches
        ]

        # Summed from cells, never averaged from the per-batch percentages. A
        # mean of rates weights a 100-cell batch the same as a 1400-cell one,
        # and on this data that is a sixteen-point error in the flattering
        # direction - see `test_the_totals_are_summed_from_cells_...`.
        started = sum(batch.cells_started for batch in batches)
        passed = sum(batch.cells_passed for batch in batches)

        # `max`/`min` over an empty series raises; an empty window is a valid
        # state, not an error, so the names are absent rather than blank.
        best = max(points, key=lambda p: p.first_pass_yield_pct, default=None)
        worst = min(points, key=lambda p: p.first_pass_yield_pct, default=None)

        return MetricsTrend(
            line_name=line.name,
            line_kind=line_kind,
            window_days=window_days,
            total_cells_started=started,
            total_cells_passed=passed,
            total_cells_scrapped=sum(batch.cells_scrapped for batch in batches),
            total_committed_value_lost_eur=round(
                float(sum(batch.committed_value_eur for batch in batches)), 2
            ),
            window_first_pass_yield_pct=_pct(passed, started),
            best_batch_code=None if best is None else best.batch_code,
            worst_batch_code=None if worst is None else worst.batch_code,
            benchmark=cohort_for(line_kind),
            points=points,
            parameters=_group_parameters(
                await self._repository.measurement_series(line.id, window_start, now)
            ),
        )
