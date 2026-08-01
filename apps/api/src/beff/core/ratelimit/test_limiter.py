"""Unit tests for the window arithmetic.

The counting itself is one SQL statement and is covered against a real database
in `tests/test_rate_limit.py` — a fake that reimplemented `ON CONFLICT DO UPDATE`
would only be testing the fake. What is worth testing without a database is how
`now` maps onto a window, because that is where the off-by-one lives.
"""

from __future__ import annotations

from datetime import UTC, datetime

from beff.core.ratelimit import RateLimit

HOUR = RateLimit(limit=5, window_seconds=3600)


def test_a_window_starts_on_its_own_boundary() -> None:
    start = HOUR.window_start(datetime(2026, 7, 31, 14, 37, 12, tzinfo=UTC))

    assert start == datetime(2026, 7, 31, 14, 0, tzinfo=UTC)


def test_every_instant_in_an_hour_maps_to_the_same_window() -> None:
    """Otherwise the counter resets partway through and the limit means nothing."""
    first = HOUR.window_start(datetime(2026, 7, 31, 14, 0, 0, tzinfo=UTC))
    last = HOUR.window_start(datetime(2026, 7, 31, 14, 59, 59, tzinfo=UTC))

    assert first == last


def test_the_next_second_starts_a_new_window() -> None:
    before = HOUR.window_start(datetime(2026, 7, 31, 14, 59, 59, tzinfo=UTC))
    after = HOUR.window_start(datetime(2026, 7, 31, 15, 0, 0, tzinfo=UTC))

    assert after > before


def test_the_window_is_timezone_aware_and_utc() -> None:
    """A naive datetime here would compare against a TIMESTAMPTZ column and
    raise — or worse, be silently interpreted as local time."""
    start = HOUR.window_start(datetime(2026, 7, 31, 14, 37, tzinfo=UTC))

    assert start.tzinfo is UTC


def test_a_short_window_still_floors_correctly() -> None:
    minute = RateLimit(limit=10, window_seconds=60)

    start = minute.window_start(datetime(2026, 7, 31, 14, 37, 42, tzinfo=UTC))

    assert start == datetime(2026, 7, 31, 14, 37, 0, tzinfo=UTC)
