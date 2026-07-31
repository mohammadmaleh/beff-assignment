"""FastAPI dependencies for the auth module."""

from beff.modules.auth.dependencies.providers import (
    CurrentUser,
    Service,
    get_auth_service,
    get_current_user,
)

__all__ = ["CurrentUser", "Service", "get_auth_service", "get_current_user"]
