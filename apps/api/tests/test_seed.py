"""The demo data, checked against the domain rather than against itself.

`seed.py`'s docstring has always said "`test_seed.py` asserts the ranges rather
than trusting this comment". This is that file.

The point is not that the seeder runs. It is that the numbers it produces are
ones a battery engineer would recognise. A 99.8% first-pass yield on a pilot line
is not impressive, it is obviously wrong to anyone who works in the industry, and
it discredits every other number on the screen - including the ones that are
right. Every range asserted below comes from `CONTEXT.md`.

The second thing under test is idempotency. `docker compose up` runs the seeder
on every boot, so a second run that appends another sixty batches would double
the dashboard's numbers on the second start and quadruple them on the fourth,
which presents as a metrics bug.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from beff.core.security import verify_password
from beff.modules.auth.models import User
from beff.modules.metrics.models import Batch, ProcessMeasurement, ScrapEvent
from beff.modules.onboarding.models import Line, OnboardingProgress, Plant
from beff.modules.privacy.models import ConsentRecord
from beff.seed.seed import (
    BATCH_COUNT,
    DEMO_EMAIL,
    DEMO_PASSWORD,
    MEASUREMENTS,
    SCRAP_WEIGHTS,
    seed,
)

pytestmark = pytest.mark.integration


async def count(session: AsyncSession, model: type) -> int:
    return int((await session.execute(select(func.count()).select_from(model))).scalar_one())


async def test_seeding_produces_a_usable_demo_account(db_session: AsyncSession) -> None:
    """The README hands these credentials to a reviewer.

    The password is asserted through `verify_password` rather than compared as a
    string: what is stored is an Argon2 hash, and the thing that must be true is
    that logging in with the documented password works.
    """
    user = await seed(db_session)

    assert user.email == DEMO_EMAIL
    assert verify_password(user.password_hash, DEMO_PASSWORD)
    assert user.deleted_at is None


async def test_the_demo_account_lands_on_the_dashboard_not_in_the_wizard(
    db_session: AsyncSession,
) -> None:
    user = await seed(db_session)

    progress = (
        await db_session.execute(
            select(OnboardingProgress).where(OnboardingProgress.user_id == user.id)
        )
    ).scalar_one()
    assert progress.current_step == "review"
    assert progress.completed_at is not None


async def test_seeding_twice_leaves_one_of_everything(db_session: AsyncSession) -> None:
    """`docker compose up` runs this on every boot.

    A second run that appended would double every figure on the dashboard, and
    the failure would present as a metrics bug rather than as a seeding one.
    """
    first = await seed(db_session)
    before = (await count(db_session, Batch), await count(db_session, ScrapEvent))

    second = await seed(db_session)
    after = (await count(db_session, Batch), await count(db_session, ScrapEvent))

    assert second.id == first.id
    assert await count(db_session, User) == 1
    assert before == after


async def test_the_seed_is_deterministic(db_session: AsyncSession) -> None:
    """The RNG is seeded so a README screenshot stays true.

    Two runs with the same seed value must agree number for number; a reviewer
    comparing their screen against the documentation should not be left
    wondering whether something changed. The rows are compared by insertion
    order rather than by `code`, because both runs number their batches from
    `B-2026-001` and ordering by a repeated key interleaves them.
    """
    await seed(db_session, seed_value=99)

    # Rename the account so the idempotency short-circuit does not answer for
    # the generator being asked about - this test is about the numbers, and
    # `test_seeding_twice_leaves_one_of_everything` is about the short-circuit.
    await db_session.execute(
        update(User).where(User.email == DEMO_EMAIL).values(email="previous@beff.example")
    )
    await db_session.flush()

    await seed(db_session, seed_value=99)

    rows = [
        (b.code, b.cells_started, b.cells_passed_eol, b.capacity_retention_pct)
        for b in (await db_session.execute(select(Batch).order_by(Batch.id))).scalars()
    ]

    assert len(rows) == 2 * BATCH_COUNT
    assert rows[:BATCH_COUNT] == rows[BATCH_COUNT:]


async def test_first_pass_yield_stays_inside_the_plausible_band(
    db_session: AsyncSession,
) -> None:
    """40-80% for a pilot line (`CONTEXT.md`).

    The upper bound is the one that matters. Anything near 99% is a mature
    gigafactory, not a line that is still being commissioned, and a reviewer who
    knows the industry stops reading at that number.
    """
    await seed(db_session)
    batches = (await db_session.execute(select(Batch))).scalars().all()

    assert len(batches) == BATCH_COUNT
    for batch in batches:
        fpy = batch.cells_passed_eol / batch.cells_started
        assert 0.40 <= fpy <= 0.80, f"{batch.code} yielded {fpy:.1%}"


async def test_the_line_improves_over_the_window(db_session: AsyncSession) -> None:
    """A pilot line getting slowly better is the story the dashboard tells.

    Asserted as first-third against last-third rather than batch-to-batch: the
    series has noise in it deliberately, and a monotonic ramp is not something
    any real line has ever produced.
    """
    await seed(db_session)
    batches = list((await db_session.execute(select(Batch).order_by(Batch.started_at))).scalars())
    third = len(batches) // 3

    def mean_yield(rows: list[Batch]) -> float:
        return sum(b.cells_passed_eol / b.cells_started for b in rows) / len(rows)

    assert mean_yield(batches[-third:]) > mean_yield(batches[:third])


async def test_capacity_retention_and_carbon_intensity_are_plausible(
    db_session: AsyncSession,
) -> None:
    """~80% at 1000 cycles is a common end-of-life threshold, so a fleet sitting
    in the high eighties is a line whose cells are healthy; 40-120 kg CO₂e/kWh
    is the grid-dependent band."""
    await seed(db_session)
    batches = (await db_session.execute(select(Batch))).scalars().all()

    for batch in batches:
        assert Decimal("80.0") <= batch.capacity_retention_pct <= Decimal("100.0")
        assert Decimal("40.0") <= batch.co2_intensity_kg_per_kwh <= Decimal("120.0")


async def test_the_scrap_breakdown_adds_up_to_the_headline_number(
    db_session: AsyncSession,
) -> None:
    """Otherwise the two halves of the dashboard disagree.

    The breakdown is distributed by weight from the same total the yield implies,
    so it can never exceed it - three unrelated random numbers would, and the
    chart would claim more cells were scrapped at each step than were ever
    started.
    """
    await seed(db_session)
    batches = (await db_session.execute(select(Batch))).scalars().all()

    for batch in batches:
        scrapped = (
            await db_session.execute(
                select(func.coalesce(func.sum(ScrapEvent.cells_scrapped), 0)).where(
                    ScrapEvent.batch_id == batch.id
                )
            )
        ).scalar_one()
        total_lost = batch.cells_started - batch.cells_passed_eol
        assert 0 <= scrapped <= total_lost


async def test_committed_value_rises_through_the_line(db_session: AsyncSession) -> None:
    """The entire economic argument the dashboard makes.

    A cell lost at formation has had a dozen process steps of material and
    energy put into it; one lost at mixing has had almost none. If the per-cell
    committed value did not rise, the scrap-cost chart would be a re-drawing of
    the scrap-count chart and would add nothing.
    """
    await seed(db_session)

    per_cell = {}
    for event in (await db_session.execute(select(ScrapEvent))).scalars():
        if event.cells_scrapped:
            per_cell[event.process_step] = event.committed_value_eur / event.cells_scrapped

    assert per_cell["formation"] > per_cell["coating"] > per_cell["mixing"]


async def test_scrap_concentrates_where_a_real_line_loses_cells(
    db_session: AsyncSession,
) -> None:
    """Coating is where the process is least stable and formation is where
    latent defects finally show. A flat distribution across twelve steps is the
    tell that the numbers were generated rather than observed."""
    await seed(db_session)

    totals: dict[str, int] = {}
    for event in (await db_session.execute(select(ScrapEvent))).scalars():
        totals[event.process_step] = totals.get(event.process_step, 0) + event.cells_scrapped

    worst = sorted(totals, key=lambda step: totals[step], reverse=True)[:2]
    assert set(worst) == {"coating", "formation"}
    assert set(totals) <= set(SCRAP_WEIGHTS)


async def test_the_newest_readings_are_exactly_the_documented_values(
    db_session: AsyncSession,
) -> None:
    """The drift walk ends *on* the constants, not near them.

    The spec-band section of the dashboard shows the newest reading per
    parameter, and `MEASUREMENTS` is what the README and this suite describe. A
    walk that merely ended nearby would leave every assertion about those
    numbers describing something the dashboard does not actually show.
    """
    await seed(db_session)
    newest = (
        await db_session.execute(select(Batch).order_by(Batch.started_at.desc()).limit(1))
    ).scalar_one()

    readings = {
        m.parameter: m
        for m in (
            await db_session.execute(
                select(ProcessMeasurement).where(ProcessMeasurement.batch_id == newest.id)
            )
        ).scalars()
    }

    for expected in MEASUREMENTS:
        actual = readings[str(expected["parameter"])]
        assert actual.value == expected["value"]
        assert actual.lower_limit == expected["lower_limit"]
        assert actual.upper_limit == expected["upper_limit"]


async def test_one_parameter_is_deliberately_out_of_spec(db_session: AsyncSession) -> None:
    """A dashboard where everything is green never demonstrates that it can show
    a problem, and the out-of-spec rendering is the signature element's whole
    point. Energy density sits just under its lower limit."""
    await seed(db_session)
    newest = (
        await db_session.execute(select(Batch).order_by(Batch.started_at.desc()).limit(1))
    ).scalar_one()

    readings = {
        m.parameter: m
        for m in (
            await db_session.execute(
                select(ProcessMeasurement).where(ProcessMeasurement.batch_id == newest.id)
            )
        ).scalars()
    }

    out_of_spec = [
        p
        for p, m in readings.items()
        if m.value < m.lower_limit or (m.upper_limit is not None and m.value > m.upper_limit)
    ]
    assert out_of_spec == ["energy_density_wh_kg"]


async def test_every_batch_carries_a_full_reading_set(db_session: AsyncSession) -> None:
    """A control chart *is* the history.

    With one row per parameter it renders a single dot and says nothing about
    whether the process is stable, which is the only question it exists to
    answer.
    """
    await seed(db_session)

    assert await count(db_session, ProcessMeasurement) == BATCH_COUNT * len(MEASUREMENTS)


async def test_the_consent_history_has_something_to_prove(db_session: AsyncSession) -> None:
    """Analytics granted and then withdrawn, so the append-only log demonstrates
    what it is for rather than holding four identical grants."""
    user = await seed(db_session)

    records = list(
        (
            await db_session.execute(
                select(ConsentRecord)
                .where(ConsentRecord.user_id == user.id)
                .order_by(ConsentRecord.recorded_at)
            )
        ).scalars()
    )

    analytics = [r for r in records if r.purpose == "analytics"]
    assert [r.granted for r in analytics] == [True, False]
    assert {r.purpose for r in records} >= {"terms_of_service", "privacy_policy"}
    assert all(r.country_code == "DE" for r in records)
    assert all(r.ip_hash is None for r in records), "seeded data holds no IP, hashed or not"


async def test_the_demo_line_is_the_pilot_line_the_context_describes(
    db_session: AsyncSession,
) -> None:
    user = await seed(db_session)

    plant = (await db_session.execute(select(Plant).where(Plant.user_id == user.id))).scalar_one()
    line = (await db_session.execute(select(Line).where(Line.plant_id == plant.id))).scalar_one()

    assert plant.country_code == "DE"
    assert line.is_pilot_line is True
    assert line.cell_format == "pouch"
