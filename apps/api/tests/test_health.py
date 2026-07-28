"""Health endpoint tests.

Thin, but they prove the whole toolchain end to end: uv resolves, the app
builds, ASGI transport works, and pytest-asyncio is wired correctly.
"""

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


async def test_openapi_schema_is_served(client: AsyncClient) -> None:
    """The generated TypeScript client depends on this being available."""
    response = await client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "Beff API"
    assert "/healthz" in schema["paths"]
