"""Render the OpenAPI document as stable JSON."""

from __future__ import annotations

import json
from typing import Any

from beff.main import create_app

__all__ = ["schema", "schema_json"]


def schema() -> dict[str, Any]:
    """The document FastAPI would serve at `/openapi.json`."""
    return create_app().openapi()


def schema_json() -> str:
    """Serialised deterministically.

    `sort_keys` because the drift check is a `git diff`: without it, a dict
    iteration order that happens to change between Python versions reads as an
    API change and fails a build that should have passed. The trailing newline
    is there because every other file in the repo has one and its absence would
    show up in every diff.
    """
    return json.dumps(schema(), indent=2, sort_keys=True, ensure_ascii=False) + "\n"
