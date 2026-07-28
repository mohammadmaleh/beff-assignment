"""The generated TypeScript client depends on this schema being served.

Lives here rather than co-located because it asserts on the assembled app, not
on any single module.
"""

from __future__ import annotations

from httpx import AsyncClient


async def test_openapi_schema_is_served(client: AsyncClient) -> None:
    response = await client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "Beff API"
    assert "/healthz" in schema["paths"]
