"""Pseudonymisation of IP addresses.

An IP address is personal data under GDPR (CONTEXT.md, "Privacy terms"), so a
raw one is never written anywhere in this application. What consent records need
is only the ability to show a data subject *that* an origin was recorded, and to
distinguish two origins from each other - both of which a salted digest gives.

The salt comes from `IP_HASH_SALT` and is not in the database. Without it the
digest would be trivially reversible: the entire IPv4 space is 2^32 values, and
a rainbow table over it fits on a laptop.
"""

from __future__ import annotations

import hashlib

__all__ = ["hash_ip"]


def hash_ip(ip_address: str, *, salt: str) -> str:
    """Return the 64-character hex digest of a salted IP address.

    Pseudonymisation, not anonymisation: with the salt and a candidate address
    the value can still be confirmed, so the result stays in GDPR scope and
    stays subject to the same retention rules as the record it sits on.
    """
    digest = hashlib.sha256()
    digest.update(salt.encode("utf-8"))
    digest.update(b"\x00")
    digest.update(ip_address.strip().encode("utf-8"))
    return digest.hexdigest()
