"""Assembles the auth router from its per-endpoint modules."""

from __future__ import annotations

from fastapi import APIRouter

from beff.modules.auth.router.login import router as login_router
from beff.modules.auth.router.logout import router as logout_router
from beff.modules.auth.router.me import router as me_router
from beff.modules.auth.router.refresh import router as refresh_router
from beff.modules.auth.router.register import router as register_router

__all__ = ["router"]

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

for sub_router in (
    register_router,
    login_router,
    refresh_router,
    logout_router,
    me_router,
):
    router.include_router(sub_router)
