"""Data access for the auth module.

The protocols are the contract a service depends on; the PostgreSQL classes and
the in-memory fakes are two implementations of it. Because the protocols are
`typing.Protocol`, neither implementation inherits from anything — a fake is
just a class with the right methods, and mypy checks that it stays that way.
"""

from beff.modules.auth.repository.fakes import (
    InMemoryEmailVerificationTokenRepository,
    InMemoryRefreshTokenRepository,
    InMemoryUserRepository,
)
from beff.modules.auth.repository.postgres import (
    PostgresEmailVerificationTokenRepository,
    PostgresRefreshTokenRepository,
    PostgresUserRepository,
)
from beff.modules.auth.repository.protocols import (
    EmailVerificationTokenRepository,
    RefreshTokenRepository,
    UserRepository,
)

__all__ = [
    "EmailVerificationTokenRepository",
    "InMemoryEmailVerificationTokenRepository",
    "InMemoryRefreshTokenRepository",
    "InMemoryUserRepository",
    "PostgresEmailVerificationTokenRepository",
    "PostgresRefreshTokenRepository",
    "PostgresUserRepository",
    "RefreshTokenRepository",
    "UserRepository",
]
