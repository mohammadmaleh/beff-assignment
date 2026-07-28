"""Fixtures shared by every test tree.

Lives at the package root because pytest only applies a `conftest.py` to its own
directory and below. Co-located unit tests under `src/` and integration tests
under `tests/` both need these, so a conftest inside either tree would be
invisible to the other.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from beff.main import create_app

__all__ = ["client"]


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """An HTTP client bound directly to the ASGI app, no network involved.

    Note: `AsyncClient(app=...)` was removed in httpx 0.28 — the shortcut shown
    in most FastAPI tutorials no longer works. `ASGITransport` is the current
    form.
    """
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
