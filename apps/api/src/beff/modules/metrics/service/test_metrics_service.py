"""Unit tests for the dashboard's arithmetic.

The interesting mistakes in a metrics service are arithmetic or windowing, never
storage, so these run against the in-memory repository with a pinned clock.
Without a fixed clock the two window boundaries move between calls and the
fixtures stop lining up - which is a test-design bug that looks exactly like a
service bug.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from beff.modules.metrics.errors import NoLineConfiguredError
from beff.modules.metrics.repository import (
    BatchTotals,
    InMemoryMetricsRepository,
    ScrapTotals,
)
from beff.modules.metrics.repository.fakes import EMPTY, totals
from beff.modules.metrics.service import MetricsService
from beff.modules.onboarding.models import Line

USER = uuid4()
WINDOW = 30
NOW = datetime(2026, 7, 31, 12, 0, tzinfo=UTC)

CURRENT = (NOW - timedelta(days=WINDOW), NOW)
PREVIOUS = (NOW - timedelta(days=WINDOW * 2), NOW - timedelta(days=WINDOW))


def line(*, pilot: bool = True) -> Line:
    row = Line(plant_id=1, name="Pilotlinie 1", cell_format="pouch", is_pilot_line=pilot)
    row.id = 1
    return row


def service(
    *,
    row: Line | None = None,
    totals_by_window: dict[tuple[datetime, datetime], BatchTotals] | None = None,
    scrap: dict[tuple[datetime, datetime], list[ScrapTotals]] | None = None,
) -> tuple[MetricsService, InMemoryMetricsRepository]:
    repository = InMemoryMetricsRepository(
        line=line() if row is None else row,
        totals=totals_by_window or {},
        scrap=scrap or {},
    )
    return MetricsService(repository, clock=lambda: NOW), repository


# ── Preconditions ────────────────────────────────────────────────────────────


async def test_an_account_with_no_line_is_not_an_empty_dashboard() -> None:
    """Zeros would render as a line running 0% yield - alarming and false. The
    client uses this code to send the user back to onboarding instead."""
    metrics = MetricsService(InMemoryMetricsRepository(line=None), clock=lambda: NOW)

    with pytest.raises(NoLineConfiguredError):
        await metrics.overview(USER)


async def test_the_line_kind_travels_with_the_numbers() -> None:
    """40-80% first-pass yield is normal on a pilot line and alarming on a
    production one. The number alone cannot be interpreted."""
    metrics, _ = service(row=line(pilot=False))

    assert (await metrics.overview(USER)).line_kind == "production"


async def test_the_line_name_is_reported() -> None:
    metrics, _ = service()

    assert (await metrics.overview(USER)).line_name == "Pilotlinie 1"


# ── Windowing ────────────────────────────────────────────────────────────────


async def test_the_two_windows_are_adjacent_and_do_not_overlap() -> None:
    """A closed interval would double-count a batch on the boundary and make a
    delta of exactly zero look like drift."""
    metrics, repository = service()
    await metrics.overview(USER, window_days=WINDOW)

    current, previous = repository.windows[0], repository.windows[1]
    assert current == CURRENT
    assert previous == PREVIOUS
    assert previous[1] == current[0]


async def test_the_window_length_is_honoured() -> None:
    metrics, repository = service()
    await metrics.overview(USER, window_days=7)

    start, end = repository.windows[0]
    assert end - start == timedelta(days=7)


# ── First-pass yield ─────────────────────────────────────────────────────────


async def test_first_pass_yield_is_passes_over_starts() -> None:
    metrics, _ = service(totals_by_window={CURRENT: totals(1000, 724), PREVIOUS: totals(1000, 710)})

    overview = await metrics.overview(USER, window_days=WINDOW)

    assert overview.first_pass_yield_pct == 72.4
    assert overview.first_pass_yield_delta_pp == pytest.approx(1.4)


async def test_a_line_that_started_nothing_has_no_yield_rather_than_perfect_yield() -> None:
    """Reporting 100% for "no data" is the most misleading default a dashboard
    can pick - it is indistinguishable from a flawless month."""
    metrics, _ = service()

    overview = await metrics.overview(USER)

    assert overview.first_pass_yield_pct == 0.0
    assert overview.scrap_rate_pct == 0.0


async def test_yield_stays_inside_a_plausible_pilot_line_range() -> None:
    """CONTEXT.md: 40-80% on a pilot line. A gate that lets 99.8% through is one
    that would have blessed the number a domain reviewer laughs at."""
    metrics, _ = service(totals_by_window={CURRENT: totals(1200, 780)})

    overview = await metrics.overview(USER, window_days=WINDOW)

    assert 40 <= overview.first_pass_yield_pct <= 80


# ── Scrap ────────────────────────────────────────────────────────────────────


async def test_scrap_is_reported_in_process_order_not_by_size() -> None:
    """A cell lost at formation has absorbed every upstream cost. Sorting by
    magnitude would destroy the economic meaning of the bar's position."""
    metrics, _ = service(
        totals_by_window={CURRENT: totals(1000, 800)},
        scrap={
            CURRENT: [
                ScrapTotals("formation", 40, Decimal("12000")),
                ScrapTotals("coating", 60, Decimal("1800")),
                ScrapTotals("calendering", 20, Decimal("900")),
            ]
        },
    )

    overview = await metrics.overview(USER, window_days=WINDOW)

    assert [row.process_step for row in overview.scrap_by_step] == [
        "coating",
        "calendering",
        "formation",
    ]


async def test_a_step_with_no_scrap_is_omitted_not_drawn_as_a_zero_bar() -> None:
    metrics, _ = service(
        totals_by_window={CURRENT: totals(1000, 950)},
        scrap={CURRENT: [ScrapTotals("coating", 50, Decimal("1500"))]},
    )

    overview = await metrics.overview(USER, window_days=WINDOW)

    assert len(overview.scrap_by_step) == 1
    assert overview.scrap_by_step[0].scrap_rate_pct == 5.0


async def test_the_committed_value_of_scrap_is_carried_through() -> None:
    """2% at calendering and 2% at formation are not the same event, and a
    dashboard reporting both as "2%" tells the reader the wrong thing."""
    metrics, _ = service(
        totals_by_window={CURRENT: totals(1000, 900)},
        scrap={CURRENT: [ScrapTotals("formation", 30, Decimal("14500.50"))]},
    )

    overview = await metrics.overview(USER, window_days=WINDOW)

    assert overview.scrap_by_step[0].committed_value_eur == pytest.approx(14500.50)


async def test_the_scrap_delta_compares_against_the_previous_window() -> None:
    metrics, _ = service(
        totals_by_window={CURRENT: totals(1000, 900), PREVIOUS: totals(1000, 880)},
        scrap={
            CURRENT: [ScrapTotals("coating", 40, Decimal("1000"))],
            PREVIOUS: [ScrapTotals("coating", 60, Decimal("1500"))],
        },
    )

    overview = await metrics.overview(USER, window_days=WINDOW)

    assert overview.scrap_rate_pct == 4.0
    assert overview.scrap_rate_delta_pp == pytest.approx(-2.0)


async def test_scrap_stays_inside_a_plausible_per_step_range() -> None:
    """CONTEXT.md: 1-8% per step."""
    metrics, _ = service(
        totals_by_window={CURRENT: totals(1000, 850)},
        scrap={
            CURRENT: [
                ScrapTotals("coating", 21, Decimal("600")),
                ScrapTotals("formation", 44, Decimal("13000")),
            ]
        },
    )

    overview = await metrics.overview(USER, window_days=WINDOW)

    for row in overview.scrap_by_step:
        assert 1 <= row.scrap_rate_pct <= 8


# ── Averages ─────────────────────────────────────────────────────────────────


async def test_an_empty_window_reports_zero_rather_than_none() -> None:
    """`None` would reach the response model as a null and render as an empty
    tile with no explanation."""
    metrics, _ = service(totals_by_window={CURRENT: EMPTY})

    overview = await metrics.overview(USER, window_days=WINDOW)

    assert overview.capacity_retention_pct == 0.0
    assert overview.co2_intensity_kg_per_kwh == 0.0


async def test_averages_are_rounded_rather_than_carrying_sql_precision() -> None:
    """`AVG` over `NUMERIC` returns full precision - 88.3248275862069 reached the
    live API before this existed. The frontend would have formatted it down to
    one decimal and looked fine, but the same number goes into the data-table
    alternative and the GDPR export, where it implies a precision the instrument
    never had."""
    metrics, _ = service(
        totals_by_window={
            CURRENT: totals(1000, 800, retention="88.3248275862069", co2="63.861724137931034")
        }
    )

    overview = await metrics.overview(USER, window_days=WINDOW)

    assert overview.capacity_retention_pct == 88.32
    assert overview.co2_intensity_kg_per_kwh == 63.86


async def test_the_averages_are_carried_through() -> None:
    metrics, _ = service(
        totals_by_window={CURRENT: totals(1000, 800, retention="88.20", co2="61.50")}
    )

    overview = await metrics.overview(USER, window_days=WINDOW)

    # CONTEXT.md: ~80% at 1000 cycles is a common EOL threshold; CO₂ intensity
    # runs 40-120 kg CO₂e/kWh depending on the grid.
    assert overview.capacity_retention_pct == pytest.approx(88.2)
    assert overview.co2_intensity_kg_per_kwh == pytest.approx(61.5)
