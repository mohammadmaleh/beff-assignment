"""Ops module - health and readiness probes.

Public API of this module. `main.py` wires `ops_router` and knows nothing about
the module's internal structure.
"""

from beff.modules.ops.router import router as ops_router

__all__ = ["ops_router"]
