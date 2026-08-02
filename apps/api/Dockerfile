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

# ── runtime ─────────────────────────────────────────────────────────────────
# The real production image. `prod` is a thin alias for it declared LAST in
# this file — see the note down there for why the ordering is load-bearing.
FROM base AS runtime

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

# ── migrate ─────────────────────────────────────────────────────────────────
# The one-shot that creates the schema and seeds the demo account, for hosts
# where compose's `migrate` service has no equivalent (Northflank calls it a
# job).
#
# It extends `runtime` rather than `runtime` being loosened to include these
# files. The distinction is the whole point: `alembic.ini` and `migrations/`
# exist in THIS image and not in the one that serves traffic, so a running API
# still cannot rewrite the schema it is serving. Same reasoning as the compose
# comment, and the same reason the bind-mounts there are scoped to `migrate`.
FROM runtime AS migrate

COPY --chown=beff:beff alembic.ini ./alembic.ini
COPY --chown=beff:beff migrations/ ./migrations/

# Fails the deploy on a bad migration instead of leaving the API to crash-loop
# against a schema that was never created. `&&` matters: a failed upgrade must
# not be followed by a seed against a half-built schema.
CMD ["sh", "-c", "alembic upgrade head && python -m beff.seed"]

# ── prod ────────────────────────────────────────────────────────────────────
# Identical to `runtime`, and LAST on purpose. This stage exists only to make
# the file's default safe.
#
# `docker build` with no `--target` builds the final stage. `migrate` has to
# come after `runtime` because it does `FROM runtime`, so if the file simply
# ended there, every target-less build would produce the migration image —
# whose CMD runs alembic and exits. An API deployed from it would never serve a
# request.
#
# That is not hypothetical. Northflank's service API accepts `dockerfileTarget`
# and silently discards it: the field round-trips as absent and no error is
# returned, so the platform builds the last stage no matter what the deployment
# definition asks for. Its *job* API honours the field, which is why
# `deploy/northflank/job-migrate.json` can still name `migrate` explicitly.
#
# The general rule this encodes: when a platform can quietly ignore your build
# target, the default has to be the one that is safe to run.
FROM runtime AS prod
