"""Dump the OpenAPI schema.

`python -m beff.openapi > openapi.json`, with no server running and no database
reachable. That matters: the schema is generated in CI to check the committed
client has not drifted, and a check that needs a live stack is a check that gets
disabled the first time it flakes.
"""

from beff.openapi.dump import schema_json

__all__ = ["schema_json"]
