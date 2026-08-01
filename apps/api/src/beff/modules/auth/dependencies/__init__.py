"""FastAPI dependencies for the auth module."""

from beff.modules.auth.dependencies.limits import (
    LOGIN_LIMIT,
    REGISTER_LIMIT,
    login_rate_limit,
    register_rate_limit,
)
from beff.modules.auth.dependencies.providers import (
    CurrentUser,
    Service,
    get_auth_service,
    get_current_user,
)

__all__ = [
    "LOGIN_LIMIT",
    "REGISTER_LIMIT",
    "CurrentUser",
    "Service",
    "get_auth_service",
    "get_current_user",
    "login_rate_limit",
    "register_rate_limit",
]
