"""The seed's numbers must be plausible to someone who works in the industry.

CONTEXT.md is explicit: "Never invent numbers outside these ranges. A 99.8%
first-pass yield on a pilot line is not impressive, it is obviously wrong, and
it discredits everything around it." These tests are what stop that happening
by accident when someone tweaks a constant.

They exercise the seed's *constants and derivations*, not the database — the
plausibility of the numbers is arithmetic, and binding it to a container would
make the check depend on Docker being available.
"""

from __future__ import annotations

import random
from decimal import Decimal
from itertools import pairwise

from beff.modules.metrics.models import PARAMETERS, PROCESS_STEPS
from beff.seed.seed import (
    BATCH_COUNT,
    COMMITTED_VALUE,
    DRIFT_ORIGIN,
    MEASUREMENTS,
    SCRAP_WEIGHTS,
    _drifted,
)

# Plausible ranges from CONTEXT.md, "Metrics". Every point on a control chart is
# a number a reviewer will read, not just the newest one.
PHYSICAL_RANGES = {
    "porosity_pct": (Decimal("28"), Decimal("38")),
    "areal_loading_mg_cm2": (Decimal("10"), Decimal("30")),
    "energy_density_wh_kg": (Decimal("150"), Decimal("300")),
}


def drifted_series(parameter: str, *, seed_value: int = 20260731) -> list[Decimal]:
    """The full history the seed would write for one parameter."""
    rng = random.Random(seed_value)  # noqa: S311 - demo data, deterministic by design
    reading = next(r for r in MEASUREMENTS if r["parameter"] == parameter)
    values = []
    for index in range(BATCH_COUNT):
        value = _drifted(reading, index=index, count=BATCH_COUNT, rng=rng)["value"]
        assert isinstance(value, Decimal)
        values.append(value)
    return values


def test_every_process_step_is_represented() -> None:
    """A missing step would silently vanish from the breakdown."""
    assert set(SCRAP_WEIGHTS) == set(PROCESS_STEPS)
    assert set(COMMITTED_VALUE) == set(PROCESS_STEPS)


def test_committed_value_rises_monotonically_through_the_line() -> None:
    """The economic argument the whole dashboard makes: a cell lost at formation
    has absorbed every upstream cost. If this ever stopped rising, the scrap
    breakdown would be telling the reader the opposite of the truth."""
    values = [COMMITTED_VALUE[step] for step in PROCESS_STEPS]
    assert values == sorted(values)
    assert all(a < b for a, b in pairwise(values))


def test_scrap_concentrates_where_it_actually_does() -> None:
    """Coating is where the process is least stable and formation is where
    latent defects finally show. A flat distribution would look synthetic to
    anyone who has stood next to a line."""
    worst = sorted(SCRAP_WEIGHTS, key=lambda step: SCRAP_WEIGHTS[step], reverse=True)[:2]
    assert set(worst) == {"coating", "formation"}


def test_the_committed_value_of_formation_scrap_dwarfs_coating() -> None:
    assert COMMITTED_VALUE["formation"] > COMMITTED_VALUE["coating"] * 3


def test_every_measured_parameter_is_one_the_schema_allows() -> None:
    for reading in MEASUREMENTS:
        assert reading["parameter"] in PARAMETERS


def test_measurement_limits_are_ordered_and_targets_sit_inside_them() -> None:
    """Mirrors the CHECK constraints, so a bad constant fails here rather than
    as an `IntegrityError` during `docker compose up`."""
    for reading in MEASUREMENTS:
        lower = reading["lower_limit"]
        upper = reading["upper_limit"]
        target = reading["target_value"]
        assert isinstance(lower, Decimal) and isinstance(upper, Decimal)
        assert lower < upper
        if target is not None:
            assert isinstance(target, Decimal)
            assert lower <= target <= upper


def test_porosity_sits_inside_the_range_context_gives() -> None:
    """30-35% after calendering."""
    porosity = next(r for r in MEASUREMENTS if r["parameter"] == "porosity_pct")
    assert Decimal("30") <= porosity["value"] <= Decimal("35")  # type: ignore[operator]


def test_areal_loading_sits_inside_the_range_context_gives() -> None:
    """10-30 mg/cm²."""
    loading = next(r for r in MEASUREMENTS if r["parameter"] == "areal_loading_mg_cm2")
    assert Decimal("10") <= loading["value"] <= Decimal("30")  # type: ignore[operator]


def test_one_parameter_is_deliberately_out_of_spec() -> None:
    """A dashboard where everything is green never demonstrates that it can show
    a problem — and the out-of-spec rendering is the signature element's whole
    point."""
    out_of_spec = [
        reading
        for reading in MEASUREMENTS
        if not (reading["lower_limit"] <= reading["value"] <= reading["upper_limit"])  # type: ignore[operator]
    ]
    assert len(out_of_spec) == 1
    assert out_of_spec[0]["parameter"] == "energy_density_wh_kg"


def test_the_out_of_spec_energy_density_is_still_physically_plausible() -> None:
    """150-300 Wh/kg for current Li-ion. Out of *this line's* spec window is not
    a licence to invent a number that could not exist."""
    energy = next(r for r in MEASUREMENTS if r["parameter"] == "energy_density_wh_kg")
    assert Decimal("150") <= energy["value"] <= Decimal("300")  # type: ignore[operator]


# ── The drifted history behind the control charts ────────────────────────────


def test_every_measured_parameter_has_a_starting_point_to_drift_from() -> None:
    """A parameter added to `MEASUREMENTS` without an origin raises `KeyError`
    inside the seed, which surfaces as a failed `docker compose up` rather than
    as anything that names the cause."""
    assert set(DRIFT_ORIGIN) == {str(r["parameter"]) for r in MEASUREMENTS}


def test_the_newest_reading_is_exactly_the_documented_value() -> None:
    """The spec bands read the newest row. If the walk merely ended *near* the
    constants, every assertion above would be describing a number the dashboard
    does not show."""
    for reading in MEASUREMENTS:
        parameter = str(reading["parameter"])
        assert drifted_series(parameter)[-1] == reading["value"]


def test_every_point_on_every_control_chart_is_physically_possible() -> None:
    """The noise term is Gaussian and therefore unbounded. Sixty draws of it are
    sixty chances to print an electrode porosity of 12%, and a reviewer only has
    to spot one to stop believing the rest of the screen."""
    for parameter, (low, high) in PHYSICAL_RANGES.items():
        assert all(low <= value <= high for value in drifted_series(parameter))


def test_energy_density_starts_in_spec_and_ends_out_of_it() -> None:
    """The whole reason the control chart earns its space. A spec band can say
    "out of spec"; only the history says "and it has been falling since week
    three", which is the difference between a problem and a diagnosis."""
    energy = next(r for r in MEASUREMENTS if r["parameter"] == "energy_density_wh_kg")
    lower = energy["lower_limit"]
    assert isinstance(lower, Decimal)

    series = drifted_series("energy_density_wh_kg")
    assert series[0] > lower
    assert series[-1] < lower


def test_the_series_is_not_a_clean_diagonal() -> None:
    """Drift with no scatter is a straight line no instrument has produced, and
    it reads as synthetic to exactly the reviewer this data exists to convince.
    Asserted as a direction reversal, which pure monotonic drift cannot show."""
    series = drifted_series("porosity_pct")
    deltas = [b - a for a, b in pairwise(series)]

    assert any(a > 0 > b or a < 0 < b for a, b in pairwise(deltas))
