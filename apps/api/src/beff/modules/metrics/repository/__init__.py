"""Data access for metrics."""

from beff.modules.metrics.repository.fakes import InMemoryMetricsRepository
from beff.modules.metrics.repository.postgres import PostgresMetricsRepository
from beff.modules.metrics.repository.protocols import (
    BatchPoint,
    BatchTotals,
    MeasurementPoint,
    MetricsRepository,
    ScrapTotals,
)

__all__ = [
    "BatchPoint",
    "BatchTotals",
    "InMemoryMetricsRepository",
    "MeasurementPoint",
    "MetricsRepository",
    "PostgresMetricsRepository",
    "ScrapTotals",
]
