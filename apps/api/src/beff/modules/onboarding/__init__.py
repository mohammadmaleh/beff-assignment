"""Onboarding module — the resumable post-registration wizard.

Captures role, plant and line setup, and units (CONTEXT.md, "Product terms").
Completing it turns scratch answers into real `plants` and `lines` rows, which
is what the dashboard then reads.

Public API of the module. `main.py` wires what this barrel exports and knows
nothing about what is inside.
"""

from beff.modules.onboarding.models import (
    CELL_FORMATS,
    ONBOARDING_STEPS,
    Line,
    OnboardingProgress,
    Plant,
)
from beff.modules.onboarding.router import router as onboarding_router

__all__ = [
    "CELL_FORMATS",
    "ONBOARDING_STEPS",
    "Line",
    "OnboardingProgress",
    "Plant",
    "onboarding_router",
]
