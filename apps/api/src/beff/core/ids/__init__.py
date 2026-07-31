"""Identifier generation.

ADR-0010 requires UUIDv7 for exposed primary keys and says the generator must be
centralised in exactly one helper rather than reimplemented per model. This is
that helper.
"""

from beff.core.ids.uuid7 import uuid7

__all__ = ["uuid7"]
