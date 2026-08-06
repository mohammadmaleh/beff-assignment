"""Unit tests for settings loading and validation."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from beff.core.config import Settings, get_settings


def test_defaults_boot_without_any_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("ENVIRONMENT", "DATABASE_URL", "JWT_SECRET", "IP_HASH_SALT", "CORS_ORIGINS"):
        monkeypatch.delenv(name, raising=False)

    settings = Settings(_env_file=None)

    assert settings.environment == "development"
    assert settings.database_url.startswith("postgresql+asyncpg://")


def test_environment_variables_use_the_names_compose_passes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@db:5432/beff")
    monkeypatch.setenv("JWT_SECRET", "s3cret")
    monkeypatch.setenv("IP_HASH_SALT", "pepper")
    monkeypatch.setenv("ENVIRONMENT", "test")

    settings = Settings(_env_file=None)

    assert settings.database_url == "postgresql+asyncpg://u:p@db:5432/beff"
    assert settings.jwt_secret == "s3cret"
    assert settings.ip_hash_salt == "pepper"
    assert settings.environment == "test"


@pytest.mark.parametrize(
    "given",
    [
        "postgres://u:p@db:5432/beff",
        "postgresql://u:p@db:5432/beff",
        "postgresql+asyncpg://u:p@db:5432/beff",
    ],
)
def test_database_url_is_normalised_to_the_async_driver(
    monkeypatch: pytest.MonkeyPatch, given: str
) -> None:
    """Managed Postgres hands out `postgres://`; SQLAlchemy needs the driver.

    Every provider - Northflank, Neon, Render, Railway, Heroku - issues a URI
    with a bare `postgres://` or `postgresql://` scheme, and `create_async_engine`
    rejects both: without `+asyncpg` it loads the *sync* psycopg driver and fails
    at connect time with `InvalidRequestError: The asyncio extension requires an
    async driver`.

    Normalising here rather than in the deployment means the platform's own
    credential injection can be wired straight to `DATABASE_URL` - no rewriting a
    secret by hand, and no password copied through a human to add six characters.
    """
    monkeypatch.setenv("DATABASE_URL", given)

    settings = Settings(_env_file=None)

    assert settings.database_url == "postgresql+asyncpg://u:p@db:5432/beff"


def test_database_url_normalisation_leaves_a_different_driver_alone(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Only the bare schemes are rewritten.

    Someone who has deliberately asked for psycopg has said something specific,
    and silently swapping their driver would be worse than the error they get.
    """
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@db:5432/beff")

    settings = Settings(_env_file=None)

    assert settings.database_url == "postgresql+psycopg://u:p@db:5432/beff"


def test_database_url_normalisation_does_not_touch_the_password(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A blunt `str.replace` would corrupt any password containing the scheme.

    Contrived, but generated passwords are arbitrary bytes and this is a
    one-character fix at the point of writing versus an unreproducible auth
    failure in production.
    """
    monkeypatch.setenv("DATABASE_URL", "postgres://u:postgres://x@db:5432/beff")

    settings = Settings(_env_file=None)

    assert settings.database_url == "postgresql+asyncpg://u:postgres://x@db:5432/beff"


def test_cors_origins_parses_a_comma_separated_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000, https://beff.example ")

    settings = Settings(_env_file=None)

    assert settings.cors_origin_list == ["http://localhost:3000", "https://beff.example"]


def test_production_refuses_to_start_on_a_placeholder_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET", "dev_only_do_not_use_in_production")
    monkeypatch.setenv("IP_HASH_SALT", "real_salt")

    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(_env_file=None)


def test_production_accepts_real_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET", "a-real-secret")
    monkeypatch.setenv("IP_HASH_SALT", "a-real-salt")

    settings = Settings(_env_file=None)

    assert settings.cookies_require_https is True


def test_cookies_are_not_secure_outside_production() -> None:
    settings = Settings(_env_file=None, environment="development")

    assert settings.cookies_require_https is False


def test_get_settings_is_cached() -> None:
    get_settings.cache_clear()

    assert get_settings() is get_settings()

    get_settings.cache_clear()
