# ============================================================
# TomAI Backend - Dockerfile Unifié (2025)
# Multi-stage optimisé pour: Development + Production + Koyeb
# Runtime: Bun 1.3 (Alpine 3.22) | Package Manager: pnpm
# Best Practices: https://docs.docker.com/guides/bun/
# ============================================================

# ===========================================
# Stage 1: BASE - Runtime minimal partagé
# ===========================================
FROM oven/bun:1.3-slim AS base

WORKDIR /app

# Dépendances système essentielles + Node.js 22 LTS pour pnpm
# Combined RUN pour réduire les layers (best practice 2025)
# IMPORTANT: pnpm version MUST match packageManager in root package.json
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && corepack enable \
    && corepack prepare pnpm@10.12.1 --activate \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Utilisateur non-root pour sécurité (OWASP best practice)
RUN groupadd --gid 1001 tomai && \
    useradd --uid 1001 --gid tomai --shell /bin/bash --create-home tomai

# ===========================================
# Stage 2: DEPS - Dépendances production
# ===========================================
FROM base AS deps

# Monorepo structure: copier la hiérarchie complète pour workspace resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared-types/package.json ./packages/shared-types/

# Installation avec cache mount - workspace resolution via pnpm
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# ===========================================
# Stage 3: BUILD - Compilation production
# ===========================================
FROM base AS build

# Build args pour tracing des déploiements
ARG GIT_COMMIT_SHA=unknown
ARG BUILD_DATE=unknown
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
ENV BUILD_DATE=${BUILD_DATE}

# Monorepo structure
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared-types/package.json ./packages/shared-types/

# Installation complète (dev + prod) pour build
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Sources et configuration (monorepo paths)
COPY apps/server/src/ ./apps/server/src/
COPY apps/server/tsconfig*.json apps/server/eslint.config.mjs ./apps/server/
COPY packages/shared-types/src/ ./packages/shared-types/src/
COPY tsconfig.base.json ./

# Build depuis le contexte monorepo
WORKDIR /app/apps/server

# Validation stricte + Build production
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

# Monorepo structure pour workspace resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Sources et config (monorepo paths)
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

# Healthcheck dev
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:3000/health || exit 1

# Dev avec hot-reload (Bun 1.3 --watch optimisé)
CMD ["bun", "--watch", "src/index.ts"]

# ===========================================
# Stage 5: PRODUCTION - Runtime optimisé
# ===========================================
FROM base AS production

WORKDIR /app

# Structure monorepo minimale pour runtime
COPY --from=deps --chown=tomai:tomai /app/node_modules ./node_modules
COPY --from=deps --chown=tomai:tomai /app/package.json ./
COPY --from=deps --chown=tomai:tomai /app/apps/server/package.json ./apps/server/
COPY --from=deps --chown=tomai:tomai /app/packages/shared-types/package.json ./packages/shared-types/

# Bundle compilé depuis le build
COPY --from=build --chown=tomai:tomai /app/apps/server/dist ./apps/server/dist

# Migrations Drizzle (Runtime Migrator)
COPY --chown=tomai:tomai apps/server/drizzle/ ./apps/server/drizzle/

WORKDIR /app/apps/server

# Variables production
ENV NODE_ENV=production

# Security: non-root user
USER tomai

# Port dynamique (Koyeb injecte $PORT)
EXPOSE ${PORT:-8000}

# Healthcheck production
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost:${PORT:-8000}/health || exit 1

# Démarrage optimisé Bun (--smol = reduced memory footprint)
CMD ["bun", "--smol", "dist/index.js"]

# ===========================================
# Metadata OCI Standards (best practice 2025)
# ===========================================
LABEL org.opencontainers.image.title="TomAI Backend"
LABEL org.opencontainers.image.description="Backend Bun + Elysia.js pour plateforme tutorat IA"
LABEL org.opencontainers.image.version="2.2.0"
LABEL org.opencontainers.image.vendor="TomAI"
LABEL org.opencontainers.image.authors="TomAI Team"
LABEL org.opencontainers.image.source="https://github.com/tomai/tomai-monorepo"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.base.name="oven/bun:1.3-slim"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT_SHA}"
