"""`python -m beff.openapi` — prints the schema to stdout."""

import sys

from beff.openapi.dump import schema_json

sys.stdout.write(schema_json())
