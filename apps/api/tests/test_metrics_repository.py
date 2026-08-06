"""The metrics SQL, against a real PostgreSQL.

## Why this file exists

Everything else that exercises the metrics repository does so through
`InMemoryMetricsRepository`. That is the right call for the service's
arithmetic — the interesting mistakes there are windowing and division, and
binding them to a container makes the check depend on Docker.

It is the wrong call for the *queries*, and this repo has already paid for that
confusion twice: a fake stands in for the database, so anything the database
would have done and the fake does not is invisible to every test that uses one.

`batch_series` is the query where that matters most. It joins an aggregated
subquery onto `batches`, and there are two ways to get it wrong that no unit
test can see:

- an **inner** join instead of an outer one silently drops every batch that
  scrapped nothing — which is to say, the best runs on the line
- joining `scrap_events` **directly** rather than through a `GROUP BY` subquery
  multiplies each batch by its number of process steps, so every `cells_started`
  in the payload comes back twelve times too large

Both produce a plausible chart. Neither raises.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from beff.modules.auth.models import User
from beff.modules.metrics.models import Batch, ProcessMeasurement, ScrapEvent
from beff.modules.metrics.repository import PostgresMetricsRepository
from beff.modules.onboarding.models import Line, Plant

pytestmark = pytest.mark.integration

NOW = datetime(2026, 7, 31, 12, 0, tzinfo=UTC)
WINDOW_START = NOW - timedelta(days=30)


async def make_line(session: AsyncSession) -> Line:
    user = User(
        email="repo@beff.example",
        password_hash="x",
        display_name="Repo",
        role="member",
    )
    session.add(user)
    await session.flush()

    plant = Plant(user_id=user.id, name="Werk Süd", country_code="DE")
    session.add(plant)
    await session.flush()

    line = Line(plant_id=plant.id, name="Pilotlinie 1", cell_format="pouch", is_pilot_line=True)
    session.add(line)
    await session.flush()
    return line


async def make_batch(
    session: AsyncSession,
    line: Line,
    *,
    code: str,
    days_ago: int,
    started: int = 1000,
    passed: int = 700,
) -> Batch:
    batch = Batch(
        line_id=line.id,
        code=code,
        started_at=NOW - timedelta(days=days_ago),
        cells_started=started,
        cells_passed_eol=passed,
        capacity_retention_pct=Decimal("88.40"),
        co2_intensity_kg_per_kwh=Decimal("61.20"),
    )
    session.add(batch)
    await session.flush()
    return batch


async def test_batch_series_returns_every_batch_in_the_window(db_session: AsyncSession) -> None:
    line = await make_line(db_session)
    await make_batch(db_session, line, code="B-001", days_ago=20)
    await make_batch(db_session, line, code="B-002", days_ago=5)
    await db_session.flush()

    series = await PostgresMetricsRepository(db_session).batch_series(line.id, WINDOW_START, NOW)

    assert [point.code for point in series] == ["B-001", "B-002"]


async def test_batch_series_keeps_a_batch_that_scrapped_nothing(db_session: AsyncSession) -> None:
    """The outer join. A perfect run is the most interesting point on the chart
    and the one an inner join silently removes."""
    line = await make_line(db_session)
    await make_batch(db_session, line, code="B-perfect", days_ago=10, started=900, passed=900)
    await db_session.flush()

    series = await PostgresMetricsRepository(db_session).batch_series(line.id, WINDOW_START, NOW)

    assert len(series) == 1
    assert series[0].cells_scrapped == 0
    assert series[0].committed_value_eur == Decimal("0")


async def test_scrap_is_aggregated_and_does_not_multiply_the_batch(
    db_session: AsyncSession,
) -> None:
    """The subquery. Joining `scrap_events` row-wise would return one row per
    process step, so a batch with three scrap events would appear three times
    and its 1 000 started cells would total 3 000."""
    line = await make_line(db_session)
    batch = await make_batch(db_session, line, code="B-001", days_ago=10, started=1000, passed=700)

    for step, cells, value in (
        ("coating", 180, "612.00"),
        ("formation", 90, "1332.00"),
        ("eol_test", 30, "492.00"),
    ):
        db_session.add(
            ScrapEvent(
                batch_id=batch.id,
                process_step=step,
                cells_scrapped=cells,
                committed_value_eur=Decimal(value),
            )
        )
    await db_session.flush()

    series = await PostgresMetricsRepository(db_session).batch_series(line.id, WINDOW_START, NOW)

    assert len(series) == 1
    assert series[0].cells_started == 1000
    assert series[0].cells_scrapped == 300
    assert series[0].committed_value_eur == Decimal("2436.00")


async def test_batch_series_excludes_batches_outside_the_window(db_session: AsyncSession) -> None:
    """Half-open: `start <= started_at < end`, so a batch never lands in both a
    window and the one it is compared against."""
    line = await make_line(db_session)
    await make_batch(db_session, line, code="B-old", days_ago=31)
    await make_batch(db_session, line, code="B-in", days_ago=29)
    await db_session.flush()

    series = await PostgresMetricsRepository(db_session).batch_series(line.id, WINDOW_START, NOW)

    assert [point.code for point in series] == ["B-in"]


async def test_batch_series_is_scoped_to_one_line(db_session: AsyncSession) -> None:
    """Two lines under one plant. A missing predicate here would mix another
    line's production into this line's chart, which is the sort of bug a demo
    with one line can never surface."""
    line = await make_line(db_session)
    other = Line(plant_id=line.plant_id, name="Pilotlinie 2", cell_format="pouch")
    db_session.add(other)
    await db_session.flush()

    await make_batch(db_session, line, code="B-mine", days_ago=10)
    await make_batch(db_session, other, code="B-theirs", days_ago=10)
    await db_session.flush()

    series = await PostgresMetricsRepository(db_session).batch_series(line.id, WINDOW_START, NOW)

    assert [point.code for point in series] == ["B-mine"]


async def test_measurement_series_carries_the_batch_time_not_the_row_time(
    db_session: AsyncSession,
) -> None:
    """The reading's own `created_at` is when the row was written, which on a
    seeded dataset is the same instant for every row — the whole control chart
    would collapse onto one tick."""
    line = await make_line(db_session)
    older = await make_batch(db_session, line, code="B-001", days_ago=20)
    newer = await make_batch(db_session, line, code="B-002", days_ago=4)

    for batch, value in ((older, "31.80"), (newer, "32.40")):
        db_session.add(
            ProcessMeasurement(
                batch_id=batch.id,
                parameter="porosity_pct",
                value=Decimal(value),
                lower_limit=Decimal("30.0"),
                upper_limit=Decimal("35.0"),
                target_value=Decimal("32.5"),
                unit="%",
            )
        )
    await db_session.flush()

    readings = await PostgresMetricsRepository(db_session).measurement_series(
        line.id, WINDOW_START, NOW
    )

    assert [reading.value for reading in readings] == [Decimal("31.800"), Decimal("32.400")]
    assert readings[0].started_at == older.started_at
    assert readings[1].started_at == newer.started_at


async def test_measurement_series_carries_the_limits_each_reading_was_judged_against(
    db_session: AsyncSession,
) -> None:
    """Stored per reading so a later spec change cannot reclassify history."""
    line = await make_line(db_session)
    batch = await make_batch(db_session, line, code="B-001", days_ago=10)
    db_session.add(
        ProcessMeasurement(
            batch_id=batch.id,
            parameter="energy_density_wh_kg",
            value=Decimal("238.0"),
            lower_limit=Decimal("240.0"),
            upper_limit=Decimal("265.0"),
            target_value=Decimal("252.0"),
            unit="Wh/kg",
        )
    )
    await db_session.flush()

    readings = await PostgresMetricsRepository(db_session).measurement_series(
        line.id, WINDOW_START, NOW
    )

    assert readings[0].lower_limit == Decimal("240.000")
    assert readings[0].upper_limit == Decimal("265.000")
    assert readings[0].unit == "Wh/kg"


async def test_an_empty_window_is_an_empty_series_not_an_error(db_session: AsyncSession) -> None:
    line = await make_line(db_session)
    await db_session.flush()

    repository = PostgresMetricsRepository(db_session)

    assert await repository.batch_series(line.id, WINDOW_START, NOW) == []
    assert await repository.measurement_series(line.id, WINDOW_START, NOW) == []


# ─────────────────────────────────────────────────────────────────────────────
# The rest of the repository.
#
# `batch_series` above is the query with the most ways to be silently wrong, so
# it got the attention first. The four below were left to the service's unit
# tests, which use a fake — and a fake answers for none of this: the half-open
# window, `AVG` over an empty set, the `DISTINCT ON`, or the join that scopes a
# line to the account that owns it.
# ─────────────────────────────────────────────────────────────────────────────


async def test_the_default_line_is_the_first_one_the_account_set_up(
    db_session: AsyncSession,
) -> None:
    line = await make_line(db_session)
    plant = (await db_session.execute(select(Plant).where(Plant.id == line.plant_id))).scalar_one()
    second = Line(
        plant_id=plant.id, name="Serienlinie 2", cell_format="prismatic", is_pilot_line=False
    )
    db_session.add(second)
    await db_session.flush()

    found = await PostgresMetricsRepository(db_session).default_line(plant.user_id)

    assert found is not None
    assert found.id == line.id


async def test_the_default_line_is_never_another_accounts(db_session: AsyncSession) -> None:
    """`lines` reaches the account through `plants`, so that join *is* the
    filter. Dropping it opens somebody else's production line as the dashboard's
    default view — a data leak that looks like a working dashboard."""
    await make_line(db_session)

    assert await PostgresMetricsRepository(db_session).default_line(uuid4()) is None


async def test_batch_totals_sum_the_counts_and_average_the_rates(
    db_session: AsyncSession,
) -> None:
    """Counts add; rates do not.

    Summing `capacity_retention_pct` across two batches produces 176%, which is
    not a number anything has ever measured — and it renders as a plausible-
    looking headline rather than as an error.
    """
    line = await make_line(db_session)
    await make_batch(db_session, line, code="B-001", days_ago=20, started=1000, passed=700)
    await make_batch(db_session, line, code="B-002", days_ago=5, started=500, passed=400)

    totals = await PostgresMetricsRepository(db_session).batch_totals(line.id, WINDOW_START, NOW)

    assert totals.cells_started == 1500
    assert totals.cells_passed == 1100
    assert totals.capacity_retention_pct == Decimal("88.40")
    assert totals.co2_intensity_kg_per_kwh == Decimal("61.20")


async def test_the_totals_window_is_half_open(db_session: AsyncSession) -> None:
    """`start <= started_at < end`, so a batch never lands in both the current
    period and the one it is compared against.

    A closed interval double-counts on the boundary, which makes a delta of
    exactly zero look like drift — and a "period over period" figure that moves
    when nothing happened is worse than no figure at all.
    """
    line = await make_line(db_session)
    repository = PostgresMetricsRepository(db_session)
    await make_batch(db_session, line, code="ON-START", days_ago=30, started=100, passed=90)
    await make_batch(db_session, line, code="ON-END", days_ago=0, started=200, passed=180)

    totals = await repository.batch_totals(line.id, WINDOW_START, NOW)

    assert totals.cells_started == 100, "the start boundary is included, the end is not"


async def test_totals_over_an_empty_window_are_zero_not_null(
    db_session: AsyncSession,
) -> None:
    """`COALESCE` on the sums, and `None` on the averages.

    Zero cells started is a fact — the line did not run — so the count is 0. An
    *average* over no rows is not zero, it is unknown, and reporting 0% capacity
    retention for a quiet week would be alarming and false.
    """
    line = await make_line(db_session)

    totals = await PostgresMetricsRepository(db_session).batch_totals(line.id, WINDOW_START, NOW)

    assert totals.cells_started == 0
    assert totals.cells_passed == 0
    assert totals.capacity_retention_pct is None
    assert totals.co2_intensity_kg_per_kwh is None


async def test_scrap_by_step_groups_and_totals_both_columns(db_session: AsyncSession) -> None:
    """Cells and euros, per step, in one pass.

    Both are summed because the dashboard makes an economic argument, not only a
    quality one: the step that loses the most cells and the step that loses the
    most value are usually not the same step, and that difference is the point.
    """
    line = await make_line(db_session)
    first = await make_batch(db_session, line, code="B-001", days_ago=20)
    second = await make_batch(db_session, line, code="B-002", days_ago=5)
    for batch in (first, second):
        db_session.add(
            ScrapEvent(
                batch_id=batch.id,
                process_step="coating",
                cells_scrapped=30,
                committed_value_eur=Decimal("102.00"),
            )
        )
    db_session.add(
        ScrapEvent(
            batch_id=second.id,
            process_step="formation",
            cells_scrapped=10,
            committed_value_eur=Decimal("148.00"),
        )
    )
    await db_session.flush()

    totals = {
        row.process_step: row
        for row in await PostgresMetricsRepository(db_session).scrap_by_step(
            line.id, WINDOW_START, NOW
        )
    }

    assert totals["coating"].cells_scrapped == 60
    assert totals["coating"].committed_value_eur == Decimal("204.00")
    assert totals["formation"].cells_scrapped == 10
    assert totals["formation"].committed_value_eur == Decimal("148.00")


async def test_scrap_by_step_respects_the_window_and_the_line(
    db_session: AsyncSession,
) -> None:
    """The filter is on `batches`, which `scrap_events` only reaches by join."""
    line = await make_line(db_session)
    stale = await make_batch(db_session, line, code="OLD", days_ago=120)
    db_session.add(
        ScrapEvent(
            batch_id=stale.id,
            process_step="coating",
            cells_scrapped=999,
            committed_value_eur=Decimal("1.00"),
        )
    )
    await db_session.flush()

    assert (
        await PostgresMetricsRepository(db_session).scrap_by_step(line.id, WINDOW_START, NOW) == []
    )


async def test_latest_measurements_is_the_newest_reading_per_parameter(
    db_session: AsyncSession,
) -> None:
    """`DISTINCT ON` ordered by the *batch's* time, not the row's.

    The spec bands show one number per parameter, and it has to be the most
    recent one. Order the `DISTINCT ON` the other way and every band shows the
    oldest reading on the line — which is stable, plausible, and two months out
    of date.
    """
    line = await make_line(db_session)
    old = await make_batch(db_session, line, code="B-001", days_ago=40)
    new = await make_batch(db_session, line, code="B-002", days_ago=1)
    for batch, value in ((old, Decimal("30.0")), (new, Decimal("32.4"))):
        db_session.add(
            ProcessMeasurement(
                batch_id=batch.id,
                parameter="porosity_pct",
                value=value,
                lower_limit=Decimal("30.0"),
                upper_limit=Decimal("35.0"),
                target_value=Decimal("32.5"),
                unit="%",
            )
        )
    await db_session.flush()

    readings = await PostgresMetricsRepository(db_session).latest_measurements(line.id)

    assert [r.value for r in readings] == [Decimal("32.4")]


async def test_latest_measurements_covers_every_parameter_once(
    db_session: AsyncSession,
) -> None:
    line = await make_line(db_session)
    batch = await make_batch(db_session, line, code="B-001", days_ago=1)
    for parameter, value, unit in (
        ("porosity_pct", Decimal("32.4"), "%"),
        ("areal_loading_mg_cm2", Decimal("21.8"), "mg/cm²"),
    ):
        db_session.add(
            ProcessMeasurement(
                batch_id=batch.id,
                parameter=parameter,
                value=value,
                lower_limit=Decimal("1.0"),
                upper_limit=Decimal("99.0"),
                target_value=value,
                unit=unit,
            )
        )
    await db_session.flush()

    readings = await PostgresMetricsRepository(db_session).latest_measurements(line.id)

    assert sorted(r.parameter for r in readings) == [
        "areal_loading_mg_cm2",
        "porosity_pct",
    ]


async def test_a_line_with_no_readings_has_no_measurements(db_session: AsyncSession) -> None:
    """An empty series, not an error — a line that was just created is a normal
    state, and the dashboard has an empty state for it."""
    line = await make_line(db_session)

    assert await PostgresMetricsRepository(db_session).latest_measurements(line.id) == []
