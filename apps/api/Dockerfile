# syntax=docker/dockerfile:1

# ── base ────────────────────────────────────────────────────────────────────
# uv ships as a static binary, so copying it from the official image avoids a
# pip bootstrap and keeps the layer small.
FROM python:3.12-slim-bookworm AS base

COPY --from=ghcr.io/astral-sh/uv:0.12.0 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# ── deps ────────────────────────────────────────────────────────────────────
# Dependencies install in their own layer keyed only on the lockfile, so editing
# source does not re-resolve the world. --frozen fails if the lock is stale.
FROM base AS deps

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --all-groups

# ── dev ─────────────────────────────────────────────────────────────────────
# Source is bind-mounted by compose, so it is deliberately not copied here.
FROM deps AS dev

# The deps stage runs --no-install-project, so the `beff` package is never
# installed into the venv. With source arriving at runtime via bind mount,
# PYTHONPATH is what makes it importable — an editable install cannot work
# against a directory that does not exist at build time.
ENV ENVIRONMENT=development \
    PYTHONPATH=/app/src

EXPOSE 8000
CMD ["uv", "run", "--no-sync", "uvicorn", "beff.main:app", \
     "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app/src"]

# ── prod ────────────────────────────────────────────────────────────────────
FROM base AS prod

# Runs unprivileged. A container that does not need root should not have it.
RUN groupadd --system --gid 1001 beff \
    && useradd --system --uid 1001 --gid beff beff

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

COPY --chown=beff:beff src/ ./src/

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

USER beff

ENV ENVIRONMENT=production

EXPOSE 8000

# No --reload, and proxy headers trusted because this sits behind a load
# balancer in production.
CMD ["uvicorn", "beff.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
