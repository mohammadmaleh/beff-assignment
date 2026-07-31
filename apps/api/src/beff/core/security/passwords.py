"""Argon2id password hashing.

Argon2id rather than bcrypt (ADR-0009): it is memory-hard, so a GPU or ASIC
attacker cannot buy the same speedup that makes bcrypt's pure-CPU cost cheap to
parallelise. Parameters follow the OWASP Password Storage Cheat Sheet minimum
for Argon2id — 19 MiB memory, 2 iterations, 1 degree of parallelism — raised to
64 MiB here because the API is not memory-constrained and memory is the axis
that actually costs an attacker.
"""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

__all__ = [
    "burn_equivalent_time",
    "hash_password",
    "password_needs_rehash",
    "verify_password",
]

_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=64 * 1024,  # KiB
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

# Used to burn the same CPU time when no user matched, so response latency does
# not answer "is this address registered?". Computed once at import.
_DUMMY_HASH = _hasher.hash("password-for-timing-equalisation")


def hash_password(password: str) -> str:
    """Return the Argon2id encoded hash, salt and parameters included."""
    return _hasher.hash(password)


def verify_password(encoded_hash: str, password: str) -> bool:
    """Check a password against its stored hash. Never raises on a mismatch."""
    try:
        return _hasher.verify(encoded_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_needs_rehash(encoded_hash: str) -> bool:
    """Whether the hash predates the current cost parameters.

    The parameters are embedded in the encoded hash, so raising the cost later
    needs no migration — only a rehash on the next successful login, when the
    plaintext is briefly available.
    """
    try:
        return _hasher.check_needs_rehash(encoded_hash)
    except InvalidHashError:
        return True


def burn_equivalent_time() -> None:
    """Verify a throwaway hash so a missing user costs the same as a wrong password.

    Without this, "no such user" returns in microseconds and "wrong password"
    takes ~50 ms, and the difference is a free account-enumeration oracle.
    """
    verify_password(_DUMMY_HASH, "not-the-password")
