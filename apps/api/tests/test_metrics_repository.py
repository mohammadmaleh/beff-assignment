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

import pytest
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
