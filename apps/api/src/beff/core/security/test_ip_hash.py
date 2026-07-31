"""Unit tests for IP pseudonymisation."""

from __future__ import annotations

from beff.core.security import hash_ip


def test_the_digest_is_64_hex_characters() -> None:
    """Matches the CHECK on `consent_records.ip_hash`."""
    digest = hash_ip("192.0.2.1", salt="pepper")

    assert len(digest) == 64
    assert set(digest) <= set("0123456789abcdef")


def test_the_raw_address_does_not_survive_in_the_output() -> None:
    assert "192.0.2.1" not in hash_ip("192.0.2.1", salt="pepper")


def test_the_same_address_and_salt_give_the_same_digest() -> None:
    """Two visits from one origin must be recognisable as one origin."""
    assert hash_ip("192.0.2.1", salt="pepper") == hash_ip("192.0.2.1", salt="pepper")


def test_different_addresses_give_different_digests() -> None:
    assert hash_ip("192.0.2.1", salt="pepper") != hash_ip("192.0.2.2", salt="pepper")


def test_the_salt_changes_the_digest() -> None:
    """Without a secret salt the whole IPv4 space is a laptop-sized rainbow table."""
    assert hash_ip("192.0.2.1", salt="pepper") != hash_ip("192.0.2.1", salt="other")


def test_surrounding_whitespace_is_ignored() -> None:
    """`X-Forwarded-For` arrives comma-and-space separated."""
    assert hash_ip(" 192.0.2.1 ", salt="pepper") == hash_ip("192.0.2.1", salt="pepper")


def test_ipv6_is_handled() -> None:
    assert len(hash_ip("2001:db8::1", salt="pepper")) == 64


def test_the_salt_is_not_merely_concatenated() -> None:
    """A bare `salt + ip` concatenation collides: ("ab", "c") and ("a", "bc")
    hash identically. A separator byte removes the ambiguity."""
    assert hash_ip("c", salt="ab") != hash_ip("bc", salt="a")
