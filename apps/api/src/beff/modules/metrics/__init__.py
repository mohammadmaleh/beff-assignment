"""Metrics — first-pass yield, scrap, capacity retention and CO₂ intensity.

Every figure is derived from `batches`, `scrap_events` and
`process_measurements` at request time. Nothing is stored pre-aggregated,
because the window is a parameter and a rollup for "last 30 days" is wrong the
moment "now" moves.

Public API of the module. `main.py` wires what this barrel exports.
"""

from beff.modules.metrics.models import (
    PARAMETERS,
    PROCESS_STEPS,
    Batch,
    ProcessMeasurement,
    ScrapEvent,
)
from beff.modules.metrics.router import router as metrics_router

__all__ = [
    "PARAMETERS",
    "PROCESS_STEPS",
    "Batch",
    "ProcessMeasurement",
    "ScrapEvent",
    "metrics_router",
]
