"""Database plumbing: declarative base, engine, session and model registry.

Domain modules import `Base` and the mixins from here to declare models, and
routers depend on `get_session`. Nothing here knows what a `User` is.
"""

from beff.db.base import Base, SoftDeleteMixin, TimestampMixin, utcnow
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
    "utcnow",
]

# `target_metadata` is deliberately NOT re-exported here, and this is the one
# import in the package that has to stay out of the barrel.
#
# `beff.db.registry` imports every domain model, which imports each domain
# module's `__init__`, which imports that module's router, which depends on
# `get_session` from this very package — a cycle, and Python fails it with a
# baffling "partially initialized module" error at the *bottom* of the chain.
#
# Alembic and the migration tests are the only consumers, and they import
# `beff.db.registry` directly. Nothing else needs the metadata, so nothing else
# pays for pulling the whole domain graph into scope.
