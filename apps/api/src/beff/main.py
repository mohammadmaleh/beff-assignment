"""Application entry point.

Wires the FastAPI app together. Route logic lives in `beff.modules.*`; this
module only assembles.
"""

from __future__ import annotations

from typing import Literal

from fastapi import FastAPI

from beff import __version__

__all__ = ["create_app"]


def create_app() -> FastAPI:
    """Build the FastAPI application.

    A factory rather than a module-level singleton so tests can construct
    isolated instances with overridden dependencies.
    """
    app = FastAPI(
        title="Beff API",
        version=__version__,
        description=("Auth, onboarding, GDPR data subject rights, and battery production metrics."),
        openapi_url="/openapi.json",
    )

    @app.get("/healthz", tags=["ops"])
    async def healthz() -> dict[str, Literal["ok"]]:
        """Liveness: the process is up. Does not touch dependencies."""
        return {"status": "ok"}

    @app.get("/readyz", tags=["ops"])
    async def readyz() -> dict[str, Literal["ok"]]:
        """Readiness: dependencies are reachable.

        Currently trivial. Extended with database and Redis checks once those
        are wired in (ENG-27, ENG-31).
        """
        return {"status": "ok"}

    return app


app = create_app()
