"""Password hashing, token minting and pseudonymisation.

One place for every cryptographic primitive in the application, so the choice of
algorithm and its parameters can be reviewed - and changed - in a single file.
"""

from beff.core.security.ip_hash import hash_ip
from beff.core.security.passwords import (
    burn_equivalent_time,
    hash_password,
    password_needs_rehash,
    verify_password,
)
from beff.core.security.tokens import (
    AccessTokenClaims,
    decode_access_token,
    encode_access_token,
    generate_refresh_token,
    generate_verification_token,
    hash_opaque_token,
    hash_refresh_token,
)

__all__ = [
    "AccessTokenClaims",
    "burn_equivalent_time",
    "decode_access_token",
    "encode_access_token",
    "generate_refresh_token",
    "generate_verification_token",
    "hash_ip",
    "hash_opaque_token",
    "hash_password",
    "hash_refresh_token",
    "password_needs_rehash",
    "verify_password",
]
