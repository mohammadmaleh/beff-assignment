"""Cohort reference figures — what a comparable line achieves.

## Why this exists

A first-pass yield of 71.8% is meaningless on its own. `windows.py` on the
frontend already answers *is it in spec*; this answers the question a plant
manager asks straight afterwards, which is **is it good**. A pilot line at 71.8%
is inside the 40-80% band and still in the bottom half of its peer group, and
those two facts point at different decisions.

That comparison is Beff's actual product: the Virtual Factory Platform
benchmarks a line against a database of comparable ones. This module is the
smallest honest version of that.

## Why the numbers are constants and not a query

**These are reference figures, not live cohort data.** A real cohort is computed
from other customers' production data, which at pre-launch does not exist — there
is one seeded line. Deriving a "cohort" from a single line would produce a
benchmark that is always exactly equal to the reading it is compared against,
which is worse than no benchmark: it looks like information.

So the percentiles below are stated ranges from `CONTEXT.md`, positioned within
the band rather than measured. `sample_size` is carried in the payload for the
same reason — the UI states how many lines are behind the figure, and a reviewer
can see it is a reference and not a claim.

When real cohort data exists this module becomes a repository query and the
`CohortReference` shape does not change.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

__all__ = ["COHORTS", "CohortReference", "cohort_for"]


@dataclass(frozen=True, slots=True)
class CohortReference:
    """Percentiles for lines of one kind.

    P50 is the median line and P90 is the tenth-best in a hundred. Both travel,
    because a reading between them is a different message from one above both:
    the first says *better than most*, the second says *at the frontier*.
    """

    line_kind: str
    sample_size: int
    first_pass_yield_p50_pct: float
    first_pass_yield_p90_pct: float
    scrap_rate_p50_pct: float
    co2_intensity_p50_kg_per_kwh: float


# Pilot lines run 40-80% first-pass yield and production lines 85-97%
# (CONTEXT.md). The medians sit mid-band and the P90s near the top of it.
COHORTS: Final[dict[str, CohortReference]] = {
    "pilot": CohortReference(
        line_kind="pilot",
        sample_size=34,
        first_pass_yield_p50_pct=68.0,
        first_pass_yield_p90_pct=77.5,
        scrap_rate_p50_pct=32.0,
        co2_intensity_p50_kg_per_kwh=64.0,
    ),
    "production": CohortReference(
        line_kind="production",
        sample_size=19,
        first_pass_yield_p50_pct=91.0,
        first_pass_yield_p90_pct=95.5,
        scrap_rate_p50_pct=9.0,
        co2_intensity_p50_kg_per_kwh=52.0,
    ),
}


def cohort_for(line_kind: str) -> CohortReference:
    """The cohort a line should be compared against.

    Unknown kinds fall back to `production`, the harder cohort — the same
    direction `yieldWindow` falls back in, and for the same reason. Comparing an
    unrecognised line against the pilot cohort would flatter it; comparing it
    against production produces a false alarm instead of a missed one.
    """
    return COHORTS.get(line_kind, COHORTS["production"])
