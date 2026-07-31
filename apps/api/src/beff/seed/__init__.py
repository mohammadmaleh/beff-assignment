"""Demo data.

A reviewer must be able to log in and see a populated dashboard without
registering an account and clicking through onboarding first. The credentials
are in the README.
"""

from beff.seed.seed import DEMO_EMAIL, DEMO_PASSWORD, seed

__all__ = ["DEMO_EMAIL", "DEMO_PASSWORD", "seed"]
