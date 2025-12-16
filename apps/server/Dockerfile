# ============================================================
# TomAI Backend - Dockerfile Unifié (2025)
# Multi-stage optimisé pour: Development + Production + Koyeb
# ============================================================

# ===========================================
# Stage 1: BASE - Runtime minimal partagé
# ===========================================
FROM oven/bun:1.1.34-slim AS base

WORKDIR /app

# Dépendances système essentielles (curl pour healthcheck, pg pour migrations)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Utilisateur non-root pour sécurité
RUN groupadd --gid 1001 tomai && \
    useradd --uid 1001 --gid tomai --shell /bin/bash --create-home tomai

# ===========================================
# Stage 2: DEPS - Dépendances production
# ===========================================
FROM base AS deps

# Monorepo: copy from root
COPY apps/server/package.json ./package.json
COPY bun.lock ./

# Installation avec cache mount pour performance
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production

# ===========================================
# Stage 3: BUILD - Compilation production
# ===========================================
FROM base AS build

# Build args optionnels
ARG GIT_COMMIT_SHA=unknown
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}

# Monorepo: copy from root
COPY apps/server/package.json ./package.json
COPY bun.lock ./

# Installation complète (dev + prod) pour build
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# Sources et configuration (monorepo paths)
COPY apps/server/src/ ./src/
COPY packages/shared-types/ ./shared-types/
COPY apps/server/tsconfig*.json apps/server/eslint.config.mjs ./

# Validation stricte obligatoire
RUN echo "=== TypeScript Validation ===" && \
    bun run typecheck:strict && \
    echo "=== ESLint Validation ===" && \
    bun run lint:ci && \
    echo "=== Build Production ===" && \
    bun build src/index.ts --outdir dist --target bun --minify --splitting --format esm && \
    echo "=== Verification ===" && \
    test -f dist/index.js || (echo "ERREUR: dist/index.js manquant" && exit 1) && \
    ls -lh dist/

# ===========================================
# Stage 4: DEVELOPMENT - Hot-reload local
# ===========================================
FROM base AS development

WORKDIR /app

# Toutes les dépendances (dev inclus) - monorepo paths
COPY apps/server/package.json ./package.json
COPY bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# Sources et config (monorepo paths)
COPY --chown=tomai:tomai apps/server/src/ ./src/
COPY --chown=tomai:tomai apps/server/drizzle/ ./drizzle/
COPY --chown=tomai:tomai packages/shared-types/ ./shared-types/
COPY --chown=tomai:tomai apps/server/tsconfig*.json apps/server/drizzle.config*.ts apps/server/eslint.config.mjs ./

ENV NODE_ENV=development
ENV DOCKER_CONTAINER=true

USER tomai
EXPOSE 3000

# Dev avec hot-reload
CMD ["bun", "--watch", "src/index.ts"]

# ===========================================
# Stage 5: PRODUCTION - Runtime optimisé
# ===========================================
FROM base AS production

WORKDIR /app

# Dépendances production uniquement
COPY --from=deps --chown=tomai:tomai /app/node_modules ./node_modules
COPY --from=deps --chown=tomai:tomai /app/package.json ./

# Bundle compilé
COPY --from=build --chown=tomai:tomai /app/dist ./dist

# Migrations Drizzle (Runtime Migrator) - monorepo path
COPY --chown=tomai:tomai apps/server/drizzle/ ./drizzle/

# Variables production
ENV NODE_ENV=production

USER tomai

# Port dynamique (Koyeb injecte $PORT)
EXPOSE ${PORT:-8000}

# Healthcheck production
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost:${PORT:-8000}/api/health || exit 1

# Démarrage optimisé Bun
CMD ["bun", "--smol", "dist/index.js"]

# ===========================================
# Metadata
# ===========================================
LABEL maintainer="TomAI Team"
LABEL version="2.0.0"
LABEL description="TomAI Backend - Unified Dockerfile (Dev + Prod)"
