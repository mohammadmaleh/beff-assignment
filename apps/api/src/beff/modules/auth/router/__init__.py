"""Barrel for the auth router.

The endpoints are split one per file because each has its own status codes,
response model and OpenAPI documentation, and a single 300-line module of them
is where those details go stale unnoticed.
"""

from beff.modules.auth.router.routes import router

__all__ = ["router"]
