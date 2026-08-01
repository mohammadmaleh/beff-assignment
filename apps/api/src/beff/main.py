"""Application entry point.

Assembles the FastAPI app from module barrels. This file wires; it does not
implement. Route logic lives in `beff.modules.*`.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from beff import __version__
from beff.core.config import get_settings
from beff.core.observability import RequestIdMiddleware, configure_logging
from beff.core.problems import install_problem_handlers
from beff.modules.auth import auth_router
from beff.modules.metrics import metrics_router
from beff.modules.onboarding import onboarding_router
from beff.modules.ops import ops_router
from beff.modules.privacy import privacy_router
from beff.modules.waitlist import waitlist_router

__all__ = ["create_app"]


def create_app() -> FastAPI:
    """Build the FastAPI application.

    A factory rather than a module-level singleton so tests can construct
    isolated instances with overridden dependencies.
    """
    settings = get_settings()

    # Before anything else, so a failure during wiring is logged in the same
    # shape as a failure during a request.
    configure_logging(json_logs=settings.environment == "production")

    app = FastAPI(
        title="Beff API",
        version=__version__,
        description="Auth, onboarding, GDPR data subject rights, and battery production metrics.",
        openapi_url="/openapi.json",
    )

    # Registered before the routers. A handler added afterwards still catches
    # the same exceptions, but keeping the order obvious is what stops someone
    # adding a route above this line and wondering why one endpoint answers in a
    # different shape from every other.
    install_problem_handlers(app, settings)

    # Outermost, so the id is bound before CORS or any handler runs and every
    # line produced by the request — including a rejected preflight — carries
    # it. Starlette applies middleware in reverse registration order, so this
    # being first is what puts it outside.
    app.add_middleware(RequestIdMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        # The refresh token is an httpOnly cookie, and the web app is on a
        # different origin to the API in every environment this runs in, so
        # credentialed requests are required. That in turn forbids a wildcard
        # origin — browsers reject the combination — which is why
        # `cors_origins` is an explicit list rather than `*`.
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(ops_router)
    app.include_router(auth_router)
    app.include_router(onboarding_router)
    app.include_router(metrics_router)
    app.include_router(privacy_router)
    app.include_router(waitlist_router)

    return app


app = create_app()
