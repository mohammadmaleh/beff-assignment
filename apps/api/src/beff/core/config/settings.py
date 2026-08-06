"""Settings loaded from the environment, validated once at import of first use."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

__all__ = ["Settings", "get_settings"]

Environment = Literal["development", "test", "production"]

# Values shipped in `docker-compose.yml` and `.env.example` so the stack boots
# with one command. They are placeholders, and production must not run on them.
_DEVELOPMENT_PLACEHOLDER_SECRETS = frozenset(
    {
        "dev_only_do_not_use_in_production",
        "dev_only_salt",
        "change_me",
    }
)


class Settings(BaseSettings):
    """Runtime configuration.

    Field names map to upper-case environment variables case-insensitively, so
    `database_url` reads `DATABASE_URL`.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: Environment = "development"

    database_url: str = "postgresql+asyncpg://beff:beff_dev_password@localhost:5432/beff"

    # Bandit flags the literal, and it is right that it is a credential - this
    # default IS the published placeholder. The validator below refuses to start
    # production on it, which is the actual control.
    jwt_secret: str = "dev_only_do_not_use_in_production"  # noqa: S105
    jwt_algorithm: str = "HS256"

    # Short-lived by design (ADR-0003): the access token is held in memory and
    # is not revocable, so its blast radius is bounded by its lifetime alone.
    access_token_ttl_seconds: int = Field(default=900, gt=0)
    refresh_token_ttl_seconds: int = Field(default=60 * 60 * 24 * 30, gt=0)

    # ADR-0003 calls this out explicitly: two browser tabs can redeem the same
    # refresh token near-simultaneously. Without a grace window, reuse detection
    # would fire on a legitimate race and log the user out. Inside the window a
    # replay is treated as that race; outside it, as theft.
    refresh_token_grace_seconds: int = Field(default=10, ge=0)

    # Salt for hashing IP addresses. A raw IP is personal data under GDPR and is
    # never stored (see CONTEXT.md, "Privacy terms").
    ip_hash_salt: str = "dev_only_salt"

    # Comma-separated rather than JSON: `CORS_ORIGINS: http://localhost:3000` in
    # docker-compose.yml is not valid JSON, and pydantic-settings parses a bare
    # `list[str]` field as JSON.
    cors_origins: str = "http://localhost:3000"

    # Base for the RFC 9457 `type` URI. A problem type should dereference to
    # human-readable documentation.
    problem_base_uri: str = "https://beff.example/problems"

    # ── Email ────────────────────────────────────────────────────────────────
    #
    # SMTP rather than a vendor SDK. Every provider speaks it, so switching one
    # for another is four environment variables and no code - and the console
    # sender below means `docker compose up` needs none of them.
    #
    # An empty `smtp_host` is not a misconfiguration to guess around: it means
    # "no transport", and the delivery worker prints the message instead of
    # sending it. That is the difference between a local stack that works and
    # one where registration fails on a connection refused.
    smtp_host: str = ""
    smtp_port: int = Field(default=587, gt=0, le=65535)
    smtp_username: str = ""
    smtp_password: str = ""

    # STARTTLS on 587, implicit TLS on 465. Both are on by default because the
    # credentials above cross the wire in the clear otherwise, and a provider
    # that needs neither is the exception, not the default worth optimising for.
    smtp_starttls: bool = True
    smtp_ssl: bool = False

    email_from: str = "Beff <no-reply@beff.example>"

    # Absolute base for the link in the message. `NEXT_PUBLIC_SITE_URL` cannot
    # be reused: Next inlines it at *build* time, so it does not exist in this
    # process at all.
    app_base_url: str = "http://localhost:3000"

    # Twenty-four hours. Long enough to survive a message sitting unread
    # overnight, short enough that a link forwarded or left in a mailbox is not
    # a standing credential.
    email_verification_ttl_seconds: int = Field(default=60 * 60 * 24, gt=0)

    @property
    def email_transport_configured(self) -> bool:
        """Whether a real SMTP transport is available.

        Read at startup to warn, not to refuse. Refusing would mean a
        deployment that has everything else right cannot boot because mail is
        not wired yet - and mail is the one feature here the app is designed to
        survive the absence of.
        """
        return bool(self.smtp_host.strip())

    @property
    def cors_origin_list(self) -> list[str]:
        """`CORS_ORIGINS` split into the list Starlette's middleware expects."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def cookies_require_https(self) -> bool:
        """Whether the refresh cookie carries `Secure`.

        Off outside production only because `Secure` cookies are dropped over
        plain HTTP, which would make local development silently fail to log in.
        """
        return self.environment == "production"

    @model_validator(mode="after")
    def normalise_database_driver(self) -> Self:
        """Accept the URI managed Postgres actually hands out.

        Northflank, Neon, Render, Railway and Heroku all issue
        `postgres://...` or `postgresql://...`. `create_async_engine` rejects
        both - without an explicit `+asyncpg` it loads the *sync* driver and
        fails at connect time with "The asyncio extension requires an async
        driver", which reads like a dependency problem rather than a URL one.

        Doing it here rather than in the deployment is what lets a platform's
        credential injection point straight at `DATABASE_URL`: no secret
        rewritten by hand, and no password routed through a human to add six
        characters. A URL that already names a driver is left alone - someone
        who asked for psycopg meant it.
        """
        prefixes = ("postgresql+", "postgres+")
        if not self.database_url.startswith(prefixes):
            for scheme in ("postgresql://", "postgres://"):
                if self.database_url.startswith(scheme):
                    # Sliced, not `str.replace` - a generated password is
                    # arbitrary bytes and may contain the scheme itself.
                    rest = self.database_url[len(scheme) :]
                    self.database_url = f"postgresql+asyncpg://{rest}"
                    break
        return self

    @model_validator(mode="after")
    def reject_placeholder_secrets_in_production(self) -> Self:
        """Fail fast rather than serve production traffic on a published secret."""
        if self.environment != "production":
            return self

        offenders = [
            name
            for name, value in (
                ("JWT_SECRET", self.jwt_secret),
                ("IP_HASH_SALT", self.ip_hash_salt),
            )
            if value in _DEVELOPMENT_PLACEHOLDER_SECRETS
        ]
        if offenders:
            raise ValueError(
                f"{', '.join(offenders)} still set to a development placeholder while "
                "ENVIRONMENT=production. Refusing to start."
            )
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Process-wide settings singleton.

    Cached so the environment is read once. Tests that need different values
    call `get_settings.cache_clear()` or override the FastAPI dependency.
    """
    return Settings()
