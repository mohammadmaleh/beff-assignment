"""Application entry point.

Assembles the FastAPI app from module barrels. This file wires; it does not
implement. Route logic lives in `beff.modules.*`.
"""

from __future__ import annotations

from fastapi import FastAPI

from beff import __version__
from beff.modules.ops import ops_router

__all__ = ["create_app"]


def create_app() -> FastAPI:
    """Build the FastAPI application.

    A factory rather than a module-level singleton so tests can construct
    isolated instances with overridden dependencies.
    """
    app = FastAPI(
        title="Beff API",
        version=__version__,
        description="Auth, onboarding, GDPR data subject rights, and battery production metrics.",
        openapi_url="/openapi.json",
    )

    app.include_router(ops_router)

    return app


app = create_app()
