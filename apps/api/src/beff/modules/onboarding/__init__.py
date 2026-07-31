"""Onboarding module — the post-registration wizard.

Captures role, plant and line setup, and units (CONTEXT.md). Currently exposes
persistence only; the wizard's HTTP surface arrives with its own issue.
"""

from beff.modules.onboarding.models import (
    CELL_FORMATS,
    ONBOARDING_STEPS,
    Line,
    OnboardingProgress,
    Plant,
)

__all__ = ["CELL_FORMATS", "ONBOARDING_STEPS", "Line", "OnboardingProgress", "Plant"]
