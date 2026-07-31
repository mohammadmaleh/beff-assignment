# syntax=docker/dockerfile:1
#
# Build context is the MONOREPO ROOT, not apps/web — the app depends on
# workspace packages that live outside its own directory.

# ── base ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@9.15.3 --activate
WORKDIR /app

# ── deps ────────────────────────────────────────────────────────────────────
# Only manifests are copied first, so the install layer is keyed on the
# lockfile and survives source edits.
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/tokens/package.json ./packages/tokens/
COPY packages/ui/package.json ./packages/ui/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile

# ── dev ─────────────────────────────────────────────────────────────────────
# Source is bind-mounted by compose, so it is deliberately not copied.
FROM deps AS dev

ENV NODE_ENV=development
EXPOSE 3000
CMD ["pnpm", "--filter", "@beff/web", "dev"]

# ── builder ─────────────────────────────────────────────────────────────────
FROM deps AS builder

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @beff/web build

# ── prod ────────────────────────────────────────────────────────────────────
# `output: 'standalone'` in next.config.ts emits a self-contained server with
# only the traced dependencies, so no node_modules is shipped.
FROM node:22-alpine AS prod

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
