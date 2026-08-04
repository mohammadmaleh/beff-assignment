"""The cohort figures have to be plausible, or they discredit the reading.

`CONTEXT.md` is explicit that a number outside its stated range is worse than no
number. These assertions pin the ranges rather than trusting the comment in
`cohort.py` that says the values came from them.
"""

from __future__ import annotations

import pytest

from beff.modules.metrics.benchmark import COHORTS, cohort_for

# From CONTEXT.md, "Metrics": first-pass yield.
YIELD_BANDS = {"pilot": (40.0, 80.0), "production": (85.0, 97.0)}


@pytest.mark.parametrize("kind", ["pilot", "production"])
def test_cohort_percentiles_sit_inside_the_documented_yield_band(kind: str) -> None:
    cohort = COHORTS[kind]
    low, high = YIELD_BANDS[kind]

    assert low <= cohort.first_pass_yield_p50_pct <= high
    assert low <= cohort.first_pass_yield_p90_pct <= high


@pytest.mark.parametrize("kind", ["pilot", "production"])
def test_p90_is_better_than_p50(kind: str) -> None:
    """Stated as percentiles, so a P90 below the median is not a bad benchmark,
    it is a mislabelled one — and the UI draws them as two ordered lines."""
    cohort = COHORTS[kind]

    assert cohort.first_pass_yield_p90_pct > cohort.first_pass_yield_p50_pct


@pytest.mark.parametrize("kind", ["pilot", "production"])
def test_co2_intensity_is_inside_the_documented_range(kind: str) -> None:
    """40-120 kg CO₂e/kWh depending on the grid (CONTEXT.md)."""
    assert 40.0 <= COHORTS[kind].co2_intensity_p50_kg_per_kwh <= 120.0


def test_a_pilot_line_is_not_judged_against_production_peers() -> None:
    assert cohort_for("pilot").line_kind == "pilot"


def test_an_unknown_line_kind_falls_back_to_the_harder_cohort() -> None:
    """The same direction `yieldWindow` falls back in. Defaulting to the pilot
    cohort would take an unrecognised production line and flatter it."""
    assert cohort_for("something-new").line_kind == "production"


def test_the_sample_size_travels_so_the_ui_can_say_what_it_is() -> None:
    """A benchmark with no stated n reads as a measurement. It is a reference."""
    assert all(cohort.sample_size > 0 for cohort in COHORTS.values())
