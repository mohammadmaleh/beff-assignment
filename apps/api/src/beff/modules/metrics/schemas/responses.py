"""Outbound metrics payloads.

Field names carry their units. `first_pass_yield_pct` and
`co2_intensity_kg_per_kwh` are unambiguous at the call site in a way that
`yield` and `co2` are not, and the frontend renders the unit from the name
rather than hard-coding a guess.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

__all__ = ["MetricsOverviewResponse", "ScrapByStepResponse", "SpecBandResponse"]


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
