"""Unit tests for the trend the dashboard's charts are drawn from.

Separate file from `test_metrics_service.py` because it is a separate question.
That file asks whether the headline arithmetic and the two comparison windows
are right; this one asks whether a *series* is right — ordering, the
per-batch derivations, the grouping into control charts, and the totals the KPI
widgets read.

Same pinned clock and same in-memory repository, for the same reason: every
window boundary is derived from "now".
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from beff.modules.metrics.errors import NoLineConfiguredError
from beff.modules.metrics.repository import BatchPoint, InMemoryMetricsRepository, MeasurementPoint
from beff.modules.metrics.repository.fakes import point, reading
from beff.modules.metrics.service import MetricsService
from beff.modules.onboarding.models import Line

USER = uuid4()
WINDOW = 30
NOW = datetime(2026, 7, 31, 12, 0, tzinfo=UTC)


def day(offset: int) -> datetime:
    """`offset` days before now. Negative offsets are inside the window."""
    return NOW - timedelta(days=offset)


def line(*, pilot: bool = True) -> Line:
    row = Line(plant_id=1, name="Pilotlinie 1", cell_format="pouch", is_pilot_line=pilot)
    row.id = 1
    return row


def service(
    *,
    row: Line | None = None,
    series: list[BatchPoint] | None = None,
    measurements: list[MeasurementPoint] | None = None,
) -> MetricsService:
    repository = InMemoryMetricsRepository(
        line=line() if row is None else row,
        series=series or [],
        measurement_points=measurements or [],
    )
    return MetricsService(repository, clock=lambda: NOW)


# ── Preconditions ────────────────────────────────────────────────────────────


async def test_an_account_with_no_line_raises_rather_than_returning_an_empty_series() -> None:
    """An empty chart and "you have not finished onboarding" are different
    screens. The overview raises here; the trend must agree, or the two calls
    the dashboard makes in parallel disagree about whether the account exists."""
    metrics = MetricsService(InMemoryMetricsRepository(line=None), clock=lambda: NOW)

    with pytest.raises(NoLineConfiguredError):
        await metrics.trend(USER)


async def test_a_line_with_no_batches_is_an_empty_series_not_an_error() -> None:
    """A configured line that has produced nothing yet is a real, valid state —
    it renders the empty state, not the error state."""
    result = await service().trend(USER)

    assert result.points == []
    assert result.total_cells_started == 0


# ── The series ───────────────────────────────────────────────────────────────


async def test_batches_come_back_oldest_first() -> None:
    """The chart reads left to right. Order is decided in SQL and asserted here
    so that a client sorting it again would be redundant rather than load-bearing."""
    result = await service(
        series=[
            point("B-003", day(2), 1000, 700),
            point("B-001", day(20), 1000, 700),
            point("B-002", day(9), 1000, 700),
        ]
    ).trend(USER)

    assert [p.batch_code for p in result.points] == ["B-001", "B-002", "B-003"]


async def test_first_pass_yield_is_computed_per_batch_not_averaged_over_the_window() -> None:
    """Two batches of very different size. The per-batch figures are 50% and
    90%; a window average weighted by size would be 86.7% and would put neither
    of them on the chart."""
    result = await service(
        series=[
            point("B-001", day(20), 100, 50),
            point("B-002", day(10), 1000, 900),
        ]
    ).trend(USER)

    assert [p.first_pass_yield_pct for p in result.points] == [50.0, 90.0]


async def test_scrap_rate_and_yield_sum_to_a_hundred_for_each_batch() -> None:
    """Every cell that started either passed end-of-line test or was scrapped —
    there is no third outcome in the schema. If these two ever fail to sum, one
    of them is being computed against the wrong denominator."""
    result = await service(
        series=[point("B-001", day(15), 1300, 871), point("B-002", day(3), 947, 700)]
    ).trend(USER)

    for entry in result.points:
        assert entry.first_pass_yield_pct + entry.scrap_rate_pct == pytest.approx(100.0)


async def test_a_batch_that_scrapped_nothing_is_kept() -> None:
    """The single most interesting point on the chart, and the one an inner join
    onto scrap events silently drops."""
    result = await service(series=[point("B-001", day(5), 900, 900, committed="0")]).trend(USER)

    assert [p.first_pass_yield_pct for p in result.points] == [100.0]
    assert result.points[0].committed_value_lost_eur == 0.0


async def test_batches_outside_the_window_are_not_on_the_chart() -> None:
    """The window is half-open and derived from the injected clock. A batch a
    day older than the window is the boundary case that an inclusive comparison
    gets wrong."""
    result = await service(
        series=[
            point("B-old", day(WINDOW + 1), 1000, 700),
            point("B-in", day(WINDOW - 1), 1000, 700),
        ]
    ).trend(USER, window_days=WINDOW)

    assert [p.batch_code for p in result.points] == ["B-in"]


# ── Totals the KPI widgets read ──────────────────────────────────────────────


async def test_the_committed_value_lost_totals_across_the_window() -> None:
    """The headline the whole product argues for: what the scrap was worth."""
    result = await service(
        series=[
            point("B-001", day(20), 1000, 700, committed="4200.50"),
            point("B-002", day(10), 1000, 800, committed="2800.25"),
        ]
    ).trend(USER)

    assert result.total_committed_value_lost_eur == 7000.75


async def test_the_totals_are_summed_from_cells_not_averaged_from_percentages() -> None:
    """Averaging the two per-batch yields gives 70%. The line actually started
    1100 cells and passed 590, which is 53.6% — a difference of sixteen points,
    and the wrong one is the flattering one."""
    result = await service(
        series=[
            point("B-001", day(20), 100, 90),
            point("B-002", day(10), 1000, 500),
        ]
    ).trend(USER)

    assert result.total_cells_started == 1100
    assert result.total_cells_passed == 590
    assert result.window_first_pass_yield_pct == 53.64


async def test_the_worst_batch_is_named_so_the_engineer_can_go_and_look_at_it() -> None:
    """A trend that says "yield fell" without saying which run is a chart the
    reader has to trace with a finger."""
    result = await service(
        series=[
            point("B-001", day(20), 1000, 800),
            point("B-002", day(10), 1000, 410),
            point("B-003", day(2), 1000, 760),
        ]
    ).trend(USER)

    assert result.worst_batch_code == "B-002"
    assert result.best_batch_code == "B-001"


async def test_there_is_no_best_or_worst_batch_when_there_are_no_batches() -> None:
    """`None`, not the empty string — the client renders the field only when it
    is present, and `""` is a batch code that formats as a blank link."""
    result = await service().trend(USER)

    assert result.worst_batch_code is None
    assert result.best_batch_code is None


# ── Control charts ───────────────────────────────────────────────────────────


async def test_measurements_are_grouped_into_one_series_per_parameter() -> None:
    result = await service(
        measurements=[
            reading("porosity_pct", day(20), "32.1"),
            reading("areal_loading_mg_cm2", day(20), "21.4", lower="18.0", upper="24.0"),
            reading("porosity_pct", day(10), "33.4"),
        ]
    ).trend(USER)

    assert [series.parameter for series in result.parameters] == [
        "areal_loading_mg_cm2",
        "porosity_pct",
    ]
    assert [p.value for p in result.parameters[1].points] == [32.1, 33.4]


async def test_a_parameter_series_carries_the_limits_it_was_judged_against() -> None:
    """Drawn as the control chart's limit lines. Without them the chart is a
    squiggle with no verdict in it."""
    result = await service(
        measurements=[reading("porosity_pct", day(10), "32.1", lower="30.0", upper="35.0")]
    ).trend(USER)

    series = result.parameters[0]
    assert (series.lower_limit, series.upper_limit, series.target) == (30.0, 35.0, 32.5)
    assert series.unit == "%"


async def test_the_limits_come_from_the_newest_reading_in_the_series() -> None:
    """Limits are stored per reading, so a window that spans a spec change holds
    two. The chart draws one pair of lines and it must be the pair in force now
    — drawing February's limits over July's readings would report in-spec
    measurements as failures."""
    result = await service(
        measurements=[
            reading("porosity_pct", day(20), "32.1", lower="30.0", upper="35.0"),
            reading("porosity_pct", day(2), "32.4", lower="31.0", upper="34.0"),
        ]
    ).trend(USER)

    assert (result.parameters[0].lower_limit, result.parameters[0].upper_limit) == (31.0, 34.0)


async def test_a_parameter_with_no_target_reports_none_rather_than_a_midpoint() -> None:
    """Inventing `(lower + upper) / 2` would draw a target line the process
    engineer never set, in the place they would look to find the one they did."""
    result = await service(
        measurements=[reading("porosity_pct", day(10), "32.1", target=None)]
    ).trend(USER)

    assert result.parameters[0].target is None


# ── The cohort benchmark ─────────────────────────────────────────────────────


async def test_a_pilot_line_is_benchmarked_against_pilot_lines() -> None:
    """A pilot line held to the production cohort reads as a catastrophe. This
    is the same mistake as banding it against production limits, one layer up."""
    result = await service(row=line(pilot=True)).trend(USER)

    assert result.benchmark.line_kind == "pilot"


async def test_a_production_line_is_benchmarked_against_production_lines() -> None:
    result = await service(row=line(pilot=False)).trend(USER)

    assert result.benchmark.line_kind == "production"
