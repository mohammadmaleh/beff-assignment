"""Auth module — registration, login, refresh-token rotation and `GET /me`.

FastAPI owns authentication end to end (ADR-0003): a short-lived JWT access
token held in browser memory, plus an httpOnly refresh cookie that is rotated on
every use and whose whole family is revoked if a spent token is replayed.

Public API of the module. `main.py` wires what this barrel exports and knows
nothing about what is inside. The HTTP surface arrives with ENG-28; for now the
module exposes persistence only.
"""

from beff.modules.auth.models import RefreshToken, User

__all__ = ["RefreshToken", "User"]
