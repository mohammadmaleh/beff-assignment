"""Barrel for the ops router.

Consumers import from here, never from the implementation file directly, so
internal file layout can change without touching call sites.
"""

from beff.modules.ops.router.health import router

__all__ = ["router"]
