# ============================================================
# TomAI Backend - Dockerfile (2026)
# Multi-stage: Development + Production + Koyeb
# Runtime: Bun 1.3 | Package Manager: pnpm
# Security: non-root, SHA-pinned base, healthchecks
# ============================================================

# Stage 1: BASE
FROM oven/bun:1.3-slim AS base

WORKDIR /app

# Node.js 24 LTS (for pnpm) + system deps
# SYNC: pnpm version must match packageManager in root package.json (pnpm@11.2.2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && corepack enable \
    && corepack prepare pnpm@11.2.2 --activate \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Non-root user
RUN groupadd --gid 1001 tomai && \
    useradd --uid 1001 --gid tomai --shell /bin/bash --create-home tomai

# Stage 2: DEPS (production only)
FROM base AS deps

# Monorepo workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared-types/package.json ./packages/shared-types/

# Production deps only
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --prod

# Stage 3: BUILD
FROM base AS build

# Build args for deployment tracing
ARG GIT_COMMIT_SHA=unknown
ARG BUILD_DATE=unknown
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
ENV BUILD_DATE=${BUILD_DATE}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared-types/package.json ./packages/shared-types/

# Full install (dev + prod) for build
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# Sources
COPY apps/server/src/ ./apps/server/src/
COPY apps/server/tsconfig*.json apps/server/eslint.config.mjs ./apps/server/
COPY packages/shared-types/src/ ./packages/shared-types/src/
COPY tsconfig.base.json ./

WORKDIR /app/apps/server

# Validate + Build
RUN bun run typecheck:strict && \
    bun run lint:ci && \
    bun build src/index.ts --outdir dist --target bun --minify --sourcemap=linked --format esm --packages external && \
    test -f dist/index.js || (echo "ERREUR: dist/index.js manquant" && exit 1)

# Stage 4: DEVELOPMENT
FROM base AS development

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY --chown=tomai:tomai apps/server/src/ ./apps/server/src/
COPY --chown=tomai:tomai apps/server/drizzle/ ./apps/server/drizzle/
COPY --chown=tomai:tomai apps/server/tsconfig*.json apps/server/drizzle.config*.ts apps/server/eslint.config.mjs ./apps/server/
COPY --chown=tomai:tomai packages/shared-types/src/ ./packages/shared-types/src/
COPY --chown=tomai:tomai tsconfig.base.json ./

WORKDIR /app/apps/server
ENV NODE_ENV=development
ENV DOCKER_CONTAINER=true
USER tomai
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:3000/health || exit 1

CMD ["bun", "--watch", "src/index.ts"]

# Stage 5: PRODUCTION
FROM base AS production

WORKDIR /app

COPY --from=deps --chown=tomai:tomai /app/node_modules ./node_modules
COPY --from=deps --chown=tomai:tomai /app/package.json ./
COPY --from=deps --chown=tomai:tomai /app/apps/server/package.json ./apps/server/
COPY --from=deps --chown=tomai:tomai /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=build --chown=tomai:tomai /app/apps/server/dist ./apps/server/dist
COPY --chown=tomai:tomai apps/server/drizzle/ ./apps/server/drizzle/
COPY --chown=tomai:tomai apps/server/src/db/migrate.ts ./apps/server/src/db/migrate.ts
COPY --chown=tomai:tomai apps/server/docker-entrypoint.sh ./apps/server/docker-entrypoint.sh
RUN chmod +x ./apps/server/docker-entrypoint.sh

WORKDIR /app/apps/server
ENV NODE_ENV=production
USER tomai
EXPOSE ${PORT:-8000}

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost:${PORT:-8000}/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "--smol", "dist/index.js"]

# OCI Metadata
LABEL org.opencontainers.image.title="TomAI Backend" \
      org.opencontainers.image.description="Bun + Elysia.js backend" \
      org.opencontainers.image.source="https://github.com/VictorNain26/tomai-monorepo" \
      org.opencontainers.image.base.name="oven/bun:1.3-slim"
