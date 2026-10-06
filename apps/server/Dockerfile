# ============================================================
# TomAI Backend - Dockerfile
# Multi-stage: web build + server build + production
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

# Stage 2: WEB — the apps/web build, served by the server on its own origin.
# Vite runs on Node (docs/etudes/2026-10-06/client-web.md); bun only installs.
FROM node:24-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS web

COPY --from=base /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json ./apps/web/
COPY packages/tokens/package.json ./packages/tokens/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts --filter web

COPY tsconfig.base.json ./
COPY packages/tokens/ ./packages/tokens/
COPY apps/web/ ./apps/web/

WORKDIR /app/apps/web
RUN bun run build && \
    test -f dist/index.html -a -f dist/sw.js || (echo "ERREUR: dist/index.html ou dist/sw.js manquant" && exit 1)

# Stage 3: BUILD
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

# Sources, and what the typecheck and the lint read
COPY apps/server/src/ ./apps/server/src/
COPY apps/server/drizzle.config.ts apps/server/tsconfig*.json apps/server/eslint.config.mjs ./apps/server/
COPY packages/eslint-config/*.js ./packages/eslint-config/
COPY tsconfig.base.json turbo.json ./

# bun build inlines process.env.NODE_ENV, bundled dependencies included: set it
# after the install, which still needs the dev dependencies.
ENV NODE_ENV=production

WORKDIR /app/apps/server

# Validate + Build (server entrypoint + migrate runner)
# bun build bundles the dependencies; what the bundles still load at runtime
# resolves against this stage's node_modules, which the production stage copies.
RUN bun run typecheck && \
    bun run lint && \
    bun run build && \
    test -f dist/main.js -a -f dist/migrate.js || (echo "ERREUR: dist/main.js ou dist/migrate.js manquant" && exit 1)

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
COPY --from=web --chown=tomai:tomai /app/apps/web/dist ./apps/web/dist
COPY --chown=tomai:tomai apps/server/drizzle/ ./apps/server/drizzle/
COPY --chown=tomai:tomai apps/server/docker-entrypoint.sh ./apps/server/docker-entrypoint.sh
RUN chmod +x ./apps/server/docker-entrypoint.sh

WORKDIR /app/apps/server
ENV NODE_ENV=production
ENV WEB_DIST_DIR=/app/apps/web/dist
USER tomai
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost:${PORT:-3000}/health/live || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "--smol", "dist/main.js"]

# OCI Metadata
LABEL org.opencontainers.image.title="TomAI Backend" \
      org.opencontainers.image.description="Bun + Hono backend, serving the web client" \
      org.opencontainers.image.source="https://github.com/VictorNain26/tomai-monorepo" \
      org.opencontainers.image.base.name="oven/bun:1.4-slim"
