"""Unit tests for the health router, co-located with the code they cover."""

from __future__ import annotations

from httpx import AsyncClient


async def test_healthz_reports_ok(client: AsyncClient) -> None:
    response = await client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_readyz_reports_ok(client: AsyncClient) -> None:
    response = await client.get("/readyz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
