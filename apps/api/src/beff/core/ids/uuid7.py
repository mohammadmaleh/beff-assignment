"""UUIDv7 generation (RFC 9562 §5.7).

PostgreSQL grew a native `uuidv7()` in 18; we target 16, so generation lives in
the application (ADR-0010). Python's `uuid` module only gains `uuid7()` in 3.14,
so it is implemented here rather than pulled in as a dependency for twenty lines.

Layout, most significant bit first:

    | 48 bits unix_ts_ms | 4 bits version (7) | 12 bits rand_a |
    | 2 bits variant (0b10) | 62 bits rand_b |

The leading millisecond timestamp is why v7 is used instead of v4: keys sort
chronologically, so inserts append to the right-hand edge of the B-tree the way
a sequence does, instead of scattering across it.
"""

from __future__ import annotations

import secrets
import time
from uuid import UUID

__all__ = ["uuid7"]

_UNIX_TS_MS_BITS = 48
_VERSION = 0x7
_VARIANT_RFC_4122 = 0b10


def uuid7() -> UUID:
    """Return a time-ordered UUIDv7.

    Ordering is guaranteed across milliseconds, not within one - two calls in
    the same millisecond differ only in their random bits. That is sufficient
    for index locality, which is the reason the version was chosen; it is not a
    monotonic counter and must not be relied on as one.
    """
    unix_ts_ms = time.time_ns() // 1_000_000
    rand_a = secrets.randbits(12)
    rand_b = secrets.randbits(62)

    value = (unix_ts_ms & ((1 << _UNIX_TS_MS_BITS) - 1)) << 80
    value |= _VERSION << 76
    value |= rand_a << 64
    value |= _VARIANT_RFC_4122 << 62
    value |= rand_b

    return UUID(int=value)
