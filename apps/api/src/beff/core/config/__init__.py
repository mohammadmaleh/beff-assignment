"""Typed application configuration.

Twelve-factor: every knob comes from the environment. The compose file is the
contract for the variable names — `DATABASE_URL`, `JWT_SECRET`, `IP_HASH_SALT`,
`CORS_ORIGINS`, `ENVIRONMENT`.
"""

from beff.core.config.settings import Settings, get_settings

__all__ = ["Settings", "get_settings"]
