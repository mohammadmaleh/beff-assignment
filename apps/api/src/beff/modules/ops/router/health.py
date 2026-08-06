"""Liveness and readiness endpoints."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter

__all__ = ["router"]

router = APIRouter(tags=["ops"])


@router.get("/healthz")
async def healthz() -> dict[str, Literal["ok"]]:
    """Liveness: the process is up.

    Deliberately touches no dependencies - an orchestrator restarting the
    container because Postgres blipped would make an outage worse, not better.
    """
    return {"status": "ok"}


@router.get("/readyz")
async def readyz() -> dict[str, Literal["ok"]]:
    """Readiness: this instance can serve traffic.

    Currently trivial. Gains a database check and a job-queue check as those
    are wired in (ENG-27, ENG-31).
    """
    return {"status": "ok"}
