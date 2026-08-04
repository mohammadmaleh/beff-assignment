"""Seed a demo account with a plausible pilot line.

Every number here comes from a range in `CONTEXT.md`. That is not decoration:
a 99.8% first-pass yield on a pilot line is not impressive, it is obviously
wrong to anyone who works in the industry, and it discredits every other number
on the screen. `test_seed.py` asserts the ranges rather than trusting this
comment.

Idempotent: running it twice leaves one demo account and one set of batches, so
`docker compose up` can run it on every boot without accumulating data.
"""

from __future__ import annotations

import asyncio
import random
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from beff.core.security import hash_password
from beff.db import create_session_factory, get_engine
from beff.modules.auth.models import User
from beff.modules.metrics.models import Batch, ProcessMeasurement, ScrapEvent
from beff.modules.onboarding.models import Line, OnboardingProgress, Plant
from beff.modules.privacy.models import CURRENT_POLICY_VERSION, ConsentRecord

__all__ = ["DEMO_EMAIL", "DEMO_PASSWORD", "seed"]

DEMO_EMAIL = "demo@beff.example"
# In the README, and only ever a demo. The account is seeded, not registered,
# so this never travels over the wire during setup.
DEMO_PASSWORD = "beff-demo-password"  # noqa: S105

BATCH_COUNT = 60
WINDOW_DAYS = 60

# Scrap concentrates at coating and formation on a real pilot line: coating is
# where the process is least stable, and formation is where latent defects
# finally show. Weights are relative, not percentages.
SCRAP_WEIGHTS: dict[str, float] = {
    "mixing": 0.4,
    "coating": 2.4,
    "drying": 0.6,
    "calendering": 1.1,
    "slitting": 0.5,
    "die_cutting": 0.4,
    "stacking": 0.7,
    "welding": 0.5,
    "filling": 0.6,
    "formation": 2.0,
    "aging": 0.7,
    "eol_test": 0.6,
}

# Value committed to a cell by the time it is lost, in euros. Rising sharply
# through the line is the entire economic argument the dashboard makes.
COMMITTED_VALUE: dict[str, Decimal] = {
    "mixing": Decimal("1.10"),
    "coating": Decimal("3.40"),
    "drying": Decimal("3.90"),
    "calendering": Decimal("4.60"),
    "slitting": Decimal("5.10"),
    "die_cutting": Decimal("5.60"),
    "stacking": Decimal("7.20"),
    "welding": Decimal("8.10"),
    "filling": Decimal("10.40"),
    "formation": Decimal("14.80"),
    "aging": Decimal("15.60"),
    "eol_test": Decimal("16.40"),
}

MEASUREMENTS: list[dict[str, object]] = [
    # Porosity after calendering runs 30-35% (CONTEXT.md).
    {
        "parameter": "porosity_pct",
        "value": Decimal("32.4"),
        "lower_limit": Decimal("30.0"),
        "upper_limit": Decimal("35.0"),
        "target_value": Decimal("32.5"),
        "unit": "%",
    },
    # Areal loading 10-30 mg/cm².
    {
        "parameter": "areal_loading_mg_cm2",
        "value": Decimal("21.8"),
        "lower_limit": Decimal("18.0"),
        "upper_limit": Decimal("24.0"),
        "target_value": Decimal("21.0"),
        "unit": "mg/cm²",
    },
    # Energy density 150-300 Wh/kg. Deliberately out of spec: a dashboard where
    # everything is green does not demonstrate that it can show a problem, and
    # the out-of-spec rendering is the signature element's whole point.
    {
        "parameter": "energy_density_wh_kg",
        "value": Decimal("238.0"),
        "lower_limit": Decimal("240.0"),
        "upper_limit": Decimal("265.0"),
        "target_value": Decimal("252.0"),
        "unit": "Wh/kg",
    },
]


# Where each parameter sat at the *start* of the window. The end of the walk is
# the value in `MEASUREMENTS`, so the newest reading is unchanged and the spec
# bands still show exactly what they showed before.
#
# Energy density is the story the control chart exists to tell: it starts
# comfortably inside the 240-265 Wh/kg window and drifts out of the bottom of it
# over two months. "It is out of spec" is what a spec band says; "it has been
# falling since week three" is what a control chart adds, and it is the
# difference between knowing there is a problem and knowing when it started.
DRIFT_ORIGIN: dict[str, Decimal] = {
    "porosity_pct": Decimal("31.9"),
    "areal_loading_mg_cm2": Decimal("21.1"),
    "energy_density_wh_kg": Decimal("251.0"),
}

# Scatter around the trend, in each parameter's own unit — measurement noise,
# which is a different thing from process drift. A series with drift and no
# noise is a clean diagonal that no instrument has ever produced, and it reads
# as synthetic to exactly the reviewer this data is meant to convince.
DRIFT_NOISE: dict[str, float] = {
    "porosity_pct": 0.42,
    "areal_loading_mg_cm2": 0.34,
    "energy_density_wh_kg": 2.30,
}


def _drifted(
    reading: dict[str, object], *, index: int, count: int, rng: random.Random
) -> dict[str, object]:
    """One reading's worth of history: the trend at `index`, plus noise.

    The final batch returns the constant untouched. That is what keeps
    `test_seed.py`'s assertions about `MEASUREMENTS` meaningful — they pin the
    values a reviewer sees on the spec bands, and a walk that merely *ended
    near* them would leave those assertions describing a number the dashboard
    does not actually show.
    """
    parameter = str(reading["parameter"])
    final = reading["value"]
    assert isinstance(final, Decimal)

    if index >= count - 1 or count < 2:
        return dict(reading)

    origin = DRIFT_ORIGIN[parameter]
    progress = Decimal(index) / Decimal(count - 1)
    trend = origin + (final - origin) * progress
    noise = Decimal(str(rng.gauss(0.0, DRIFT_NOISE[parameter])))

    return {**reading, "value": (trend + noise).quantize(Decimal("0.001"))}


async def seed(session: AsyncSession, *, seed_value: int = 20260731) -> User:
    """Create or refresh the demo account. Returns the user.

    The RNG is seeded, so the dashboard shows the same figures on every machine
    — a screenshot in the README stays true, and a reviewer comparing two runs
    is not left wondering whether something changed.
    """
    # Demo data, not a key. A seeded, reproducible generator is the point:
    # the dashboard shows the same figures on every machine, so a README
    # screenshot stays true and two runs are comparable.
    rng = random.Random(seed_value)  # noqa: S311

    existing = (
        await session.execute(select(User).where(User.email == DEMO_EMAIL))
    ).scalar_one_or_none()
    if existing is not None:
        # Already seeded. Returning rather than re-creating is what makes this
        # safe to run on every container start.
        return existing

    user = User(
        email=DEMO_EMAIL,
        password_hash=hash_password(DEMO_PASSWORD),
        display_name="Demo Engineer",
        role="member",
    )
    session.add(user)
    await session.flush()

    # Onboarding already finished, so the demo lands on the dashboard rather
    # than in the wizard.
    session.add(
        OnboardingProgress(
            user_id=user.id,
            current_step="review",
            answers={
                "role": "process_engineer",
                "plant_name": "Werk Süd",
                "plant_country": "DE",
                "line_name": "Pilotlinie 1",
                "line_kind": "pilot",
                "cell_format": "pouch",
                "unit_system": "metric",
            },
            completed_at=datetime.now(UTC) - timedelta(days=WINDOW_DAYS),
        )
    )

    # Consent as it would actually have been recorded: the two mandatory
    # purposes accepted at registration, analytics granted then withdrawn, so
    # the append-only history has something in it to prove.
    recorded = datetime.now(UTC) - timedelta(days=WINDOW_DAYS)
    for purpose, granted, offset in (
        ("terms_of_service", True, 0),
        ("privacy_policy", True, 0),
        ("analytics", True, 1),
        ("analytics", False, 20),
    ):
        session.add(
            ConsentRecord(
                user_id=user.id,
                purpose=purpose,
                granted=granted,
                policy_version=CURRENT_POLICY_VERSION,
                recorded_at=recorded + timedelta(days=offset),
                country_code="DE",
            )
        )

    plant = Plant(user_id=user.id, name="Werk Süd", country_code="DE")
    session.add(plant)
    await session.flush()

    line = Line(
        plant_id=plant.id,
        name="Pilotlinie 1",
        cell_format="pouch",
        is_pilot_line=True,
    )
    session.add(line)
    await session.flush()

    now = datetime.now(UTC)
    for index in range(BATCH_COUNT):
        started = now - timedelta(days=WINDOW_DAYS) + timedelta(days=index)

        cells_started = rng.randint(800, 1400)

        # A pilot line improving slowly over two months. 40-80% is the
        # plausible band; this walks from roughly 64% to roughly 74%.
        base_yield = 0.64 + (index / BATCH_COUNT) * 0.10
        yield_fraction = min(0.80, max(0.40, base_yield + rng.uniform(-0.03, 0.03)))
        cells_passed = int(cells_started * yield_fraction)

        batch = Batch(
            line_id=line.id,
            code=f"B-2026-{index + 1:03d}",
            started_at=started,
            cells_started=cells_started,
            cells_passed_eol=cells_passed,
            # ~80% at 1000 cycles is a common end-of-life threshold.
            capacity_retention_pct=Decimal(str(round(rng.uniform(86.0, 91.0), 2))),
            # 40-120 kg CO₂e/kWh depending on the grid.
            co2_intensity_kg_per_kwh=Decimal(str(round(rng.uniform(56.0, 68.0), 2))),
        )
        session.add(batch)
        await session.flush()

        # The scrapped cells are distributed across steps by weight, so the
        # breakdown sums to what the headline scrap rate claims rather than
        # being three unrelated random numbers.
        scrapped_total = cells_started - cells_passed
        weight_sum = sum(SCRAP_WEIGHTS.values())
        for step, weight in SCRAP_WEIGHTS.items():
            cells = int(scrapped_total * (weight / weight_sum))
            if cells == 0:
                continue
            session.add(
                ScrapEvent(
                    batch_id=batch.id,
                    process_step=step,
                    cells_scrapped=cells,
                    committed_value_eur=COMMITTED_VALUE[step] * cells,
                )
            )

        # A reading per parameter on every batch.
        #
        # This used to be the newest batch only, on the reasoning that the
        # dashboard shows the latest reading per parameter and sixty of each
        # would be sixty times the rows for the same three numbers. That was
        # true of the spec bands and false of the control charts: a control
        # chart *is* the history, and with one row per parameter it renders a
        # single dot and says nothing about whether the process is stable.
        #
        # The newest batch still lands exactly on the values in `MEASUREMENTS`,
        # so the spec-band section is unchanged and its assertions still hold.
        for reading in MEASUREMENTS:
            session.add(
                ProcessMeasurement(
                    batch_id=batch.id,
                    **_drifted(reading, index=index, count=BATCH_COUNT, rng=rng),
                )
            )

    await session.commit()
    return user


async def main() -> None:  # pragma: no cover - entry point
    """`python -m beff.seed` — used by compose and by the README's instructions."""
    factory = create_session_factory(get_engine())
    async with factory() as session:
        user = await seed(session)
    print(f"Seeded demo account: {user.email}")  # noqa: T201


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(main())
