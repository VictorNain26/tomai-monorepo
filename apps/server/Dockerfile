# ============================================================
# TomAI Backend - Dockerfile (2026)
# Multi-stage: Development + Production + Koyeb
# Runtime and package manager: Bun 1.4
# Security: non-root, SHA-pinned base, healthchecks
# ============================================================

# Stage 1: BASE
FROM oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61 AS base

WORKDIR /app

# curl for the HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Non-root user
RUN groupadd --gid 1001 tomai && \
    useradd --uid 1001 --gid tomai --shell /bin/bash --create-home tomai

# Stage 2: BUILD
FROM base AS build

# Build args for deployment tracing
ARG GIT_COMMIT_SHA=unknown
ARG BUILD_DATE=unknown
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
ENV BUILD_DATE=${BUILD_DATE}

COPY package.json bun.lock bunfig.toml ./
COPY apps/server/package.json ./apps/server/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Full install (dev + prod) for build
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts --filter tomai-server

# Sources, and the test runner the typecheck and the lint read too
COPY apps/server/src/ ./apps/server/src/
COPY apps/server/scripts/ ./apps/server/scripts/
COPY apps/server/tsconfig*.json apps/server/eslint.config.mjs ./apps/server/
COPY packages/eslint-config/*.js ./packages/eslint-config/
COPY tsconfig.base.json turbo.json ./

# bun build inlines process.env.NODE_ENV, bundled dependencies included: set it
# after the install, which still needs the dev dependencies.
ENV NODE_ENV=production

WORKDIR /app/apps/server

# Validate + Build (server entrypoint + migrate runner)
# Both are bundled with --packages external; their externals must resolve against
# the same node_modules that production stage gets (= this stage's, see below).
RUN bun run typecheck:strict && \
    bun run lint && \
    bun run build && \
    test -f dist/index.js -a -f dist/migrate.js || (echo "ERREUR: dist/index.js ou dist/migrate.js manquant" && exit 1)

# Stage 3: DEVELOPMENT
FROM base AS development

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
COPY apps/server/package.json ./apps/server/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --filter tomai-server

COPY --chown=tomai:tomai apps/server/src/ ./apps/server/src/
COPY --chown=tomai:tomai apps/server/drizzle/ ./apps/server/drizzle/
COPY --chown=tomai:tomai apps/server/tsconfig*.json apps/server/drizzle.config*.ts apps/server/eslint.config.mjs ./apps/server/
COPY --chown=tomai:tomai tsconfig.base.json ./

WORKDIR /app/apps/server
ENV NODE_ENV=development
ENV DOCKER_CONTAINER=true
USER tomai
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:3000/health || exit 1

CMD ["bun", "--watch", "src/index.ts"]

# Stage 4: PRODUCTION
FROM base AS production

WORKDIR /app

# Build args for deployment tracing — ARG/ENV du stage `build` ne se propagent
# PAS ici (stage indépendant issu de `base`), donc on les redéclare.
ARG GIT_COMMIT_SHA=unknown
ARG BUILD_DATE=unknown
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
ENV BUILD_DATE=${BUILD_DATE}

# node_modules vient du stage `build` (= même résolution que pour le bundling),
# pour éliminer le drift entre l'install qui a vu le code compiler et celui qui
# sert le runtime. Coût: ~30 MB de devDeps en plus, bénéfice: dev=prod, plus de
# "Cannot find module" silencieux.
COPY --from=build --chown=tomai:tomai /app/node_modules ./node_modules
COPY --from=build --chown=tomai:tomai /app/package.json ./
COPY --from=build --chown=tomai:tomai /app/apps/server/package.json ./apps/server/
COPY --from=build --chown=tomai:tomai /app/apps/server/dist ./apps/server/dist
COPY --chown=tomai:tomai apps/server/drizzle/ ./apps/server/drizzle/
COPY --chown=tomai:tomai apps/server/docker-entrypoint.sh ./apps/server/docker-entrypoint.sh
RUN chmod +x ./apps/server/docker-entrypoint.sh

# Smoke import: échoue le `docker build` si un module externalisé du bundle
# n'est pas résolvable depuis node_modules (la classe de bug qui a cassé PR #120
# avec `drizzle-orm/postgres-js/migrator`). On teste seulement migrate.js car
# index.js a un side-effect top-level (startServer) qui requiert la DB.
# migrate.ts est gardé par `if (import.meta.main)`, donc l'import est safe.
RUN bun --eval "await import('./apps/server/dist/migrate.js'); console.log('smoke OK')" \
    || (echo "ERREUR: smoke import a échoué — un externalisé n'est pas résolvable au runtime" && exit 1)

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
      org.opencontainers.image.description="Bun + Hono backend" \
      org.opencontainers.image.source="https://github.com/VictorNain26/tomai-monorepo" \
      org.opencontainers.image.base.name="oven/bun:1.4-slim"
