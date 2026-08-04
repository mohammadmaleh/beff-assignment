"""Outbound metrics payloads.

Field names carry their units. `first_pass_yield_pct` and
`co2_intensity_kg_per_kwh` are unambiguous at the call site in a way that
`yield` and `co2` are not, and the frontend renders the unit from the name
rather than hard-coding a guess.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

__all__ = [
    "CohortReferenceResponse",
    "MetricsOverviewResponse",
    "MetricsTrendResponse",
    "ParameterPointResponse",
    "ParameterSeriesResponse",
    "ScrapByStepResponse",
    "SpecBandResponse",
    "TrendPointResponse",
]


class ScrapByStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    process_step: str
    scrap_rate_pct: float
    committed_value_eur: float


class SpecBandResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    parameter: str
    value: float
    lower_limit: float
    upper_limit: float
    target: float | None
    unit: str


class MetricsOverviewResponse(BaseModel):
    """Everything the dashboard renders, in one request.

    One round trip rather than four: the four headline tiles, the breakdown and
    the bands are read together or not at all, and splitting them would put
    three extra waterfalls in front of the first paint for no reuse.
    """

    model_config = ConfigDict(from_attributes=True)

    line_name: str
    line_kind: str
    window_days: int
    first_pass_yield_pct: float
    first_pass_yield_delta_pp: float
    scrap_rate_pct: float
    scrap_rate_delta_pp: float
    capacity_retention_pct: float
    co2_intensity_kg_per_kwh: float
    scrap_by_step: list[ScrapByStepResponse]
    spec_bands: list[SpecBandResponse]


class TrendPointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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


class ParameterPointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    started_at: datetime
    value: float


class ParameterSeriesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    parameter: str
    unit: str
    lower_limit: float
    upper_limit: float
    target: float | None
    points: list[ParameterPointResponse]


class CohortReferenceResponse(BaseModel):
    """What comparable lines achieve.

    `sample_size` is part of the contract, not decoration. A benchmark rendered
    without its n reads as a measurement of something; the UI states "34 pilot
    lines" beside it so it reads as what it is.
    """

    model_config = ConfigDict(from_attributes=True)

    line_kind: str
    sample_size: int
    first_pass_yield_p50_pct: float
    first_pass_yield_p90_pct: float
    scrap_rate_p50_pct: float
    co2_intensity_p50_kg_per_kwh: float


class MetricsTrendResponse(BaseModel):
    """The series behind the charts, in one request.

    Separate from the overview by design — see `MetricsTrend`. The overview is
    what the page needs for its first useful pixel; this is sixty batches, and
    putting it in the same payload would make the headline wait on data it does
    not use.
    """

    model_config = ConfigDict(from_attributes=True)

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
    benchmark: CohortReferenceResponse
    points: list[TrendPointResponse]
    parameters: list[ParameterSeriesResponse]
