"""Unit tests for UUIDv7 generation."""

from __future__ import annotations

import time

from beff.core.ids import uuid7


def test_version_and_variant_are_rfc_9562_compliant() -> None:
    value = uuid7()

    assert value.version == 7
    # RFC 9562 variant 0b10xx — Python exposes this as "specified in RFC 4122".
    assert value.variant == "specified in RFC 4122"


def test_leading_bits_encode_the_current_unix_millisecond() -> None:
    before = time.time_ns() // 1_000_000
    value = uuid7()
    after = time.time_ns() // 1_000_000

    encoded_ms = value.int >> 80

    assert before <= encoded_ms <= after


def test_ids_generated_in_later_milliseconds_sort_after_earlier_ones() -> None:
    first = uuid7()
    time.sleep(0.002)
    second = uuid7()

    assert first.int < second.int
    # Lexicographic ordering of the hex form matches integer ordering, which is
    # what makes the B-tree append rather than split.
    assert str(first) < str(second)


def test_ids_are_unique_within_a_single_millisecond() -> None:
    generated = {uuid7() for _ in range(1000)}

    assert len(generated) == 1000
