"""Data access for onboarding.

`Protocol` rather than a base class, so the service takes a fake in unit tests
without inheriting anything - and mypy checks the fakes against the same
protocol as the PostgreSQL implementations, so a protocol change cannot leave
them behind.
"""

from beff.modules.onboarding.repository.fakes import (
    InMemoryOnboardingRepository,
    InMemorySetupRepository,
)
from beff.modules.onboarding.repository.postgres import (
    PostgresOnboardingRepository,
    PostgresSetupRepository,
)
from beff.modules.onboarding.repository.protocols import (
    OnboardingRepository,
    SetupRepository,
)

__all__ = [
    "InMemoryOnboardingRepository",
    "InMemorySetupRepository",
    "OnboardingRepository",
    "PostgresOnboardingRepository",
    "PostgresSetupRepository",
    "SetupRepository",
]
