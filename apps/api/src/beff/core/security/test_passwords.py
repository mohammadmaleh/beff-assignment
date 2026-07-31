"""Unit tests for Argon2id password hashing."""

from __future__ import annotations

from time import perf_counter

from beff.core.security import (
    burn_equivalent_time,
    hash_password,
    password_needs_rehash,
    verify_password,
)


def test_a_hash_is_not_the_password() -> None:
    encoded = hash_password("correct horse battery staple")

    assert "correct horse battery staple" not in encoded


def test_the_hash_names_argon2id_and_its_parameters() -> None:
    """The parameters travel with the hash, which is why raising them later
    needs no migration."""
    encoded = hash_password("correct horse battery staple")

    assert encoded.startswith("$argon2id$")
    assert "m=65536" in encoded
    assert "t=3" in encoded
    assert "p=4" in encoded


def test_the_same_password_hashes_differently_every_time() -> None:
    """A per-hash salt is what stops one rainbow table covering every user."""
    first = hash_password("correct horse battery staple")
    second = hash_password("correct horse battery staple")

    assert first != second


def test_the_right_password_verifies() -> None:
    encoded = hash_password("correct horse battery staple")

    assert verify_password(encoded, "correct horse battery staple") is True


def test_the_wrong_password_does_not_verify() -> None:
    encoded = hash_password("correct horse battery staple")

    assert verify_password(encoded, "Correct horse battery staple") is False


def test_verification_returns_false_rather_than_raising_on_a_corrupt_hash() -> None:
    """A malformed stored hash must fail the login, not 500 the endpoint."""
    assert verify_password("not-an-argon2-hash", "anything") is False


def test_a_hash_at_current_parameters_does_not_need_rehashing() -> None:
    assert password_needs_rehash(hash_password("correct horse battery staple")) is False


def test_a_weaker_hash_is_flagged_for_rehash() -> None:
    weak = "$argon2id$v=19$m=8,t=1,p=1$c29tZXNhbHRzb21lc2E$JYQTMzVGRXNlckRoWXhBS0FxdGZzZz09"

    assert password_needs_rehash(weak) is True


def test_an_unparseable_hash_is_flagged_for_rehash() -> None:
    assert password_needs_rehash("garbage") is True


def test_burning_equivalent_time_actually_costs_time() -> None:
    """Called on the "no such user" path purely to equalise response latency.

    Asserting it returns `None` would pass just as well if the body were
    deleted, and a no-op here is exactly the bug: answering in microseconds when
    no account exists and in ~50 ms when one does is a free account-enumeration
    oracle. The floor is deliberately far below a real Argon2 verification so
    the test does not become a flaky CPU-speed benchmark.
    """
    start = perf_counter()
    burn_equivalent_time()
    assert perf_counter() - start > 0.001
