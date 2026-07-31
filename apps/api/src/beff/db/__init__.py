"""Database plumbing: declarative base, engine, session and model registry.

Domain modules import `Base` and the mixins from here to declare models, and
routers depend on `get_session`. Nothing here knows what a `User` is.
"""

from beff.db.base import Base, SoftDeleteMixin, TimestampMixin, utcnow
from beff.db.registry import target_metadata
from beff.db.session import (
    create_session_factory,
    dispose_engine,
    get_engine,
    get_session,
    get_session_factory,
)

__all__ = [
    "Base",
    "SoftDeleteMixin",
    "TimestampMixin",
    "create_session_factory",
    "dispose_engine",
    "get_engine",
    "get_session",
    "get_session_factory",
    "target_metadata",
    "utcnow",
]
