"""Data access for metrics."""

from beff.modules.metrics.repository.fakes import InMemoryMetricsRepository
from beff.modules.metrics.repository.postgres import PostgresMetricsRepository
from beff.modules.metrics.repository.protocols import (
    BatchTotals,
    MetricsRepository,
    ScrapTotals,
)

__all__ = [
    "BatchTotals",
    "InMemoryMetricsRepository",
    "MetricsRepository",
    "PostgresMetricsRepository",
    "ScrapTotals",
]
