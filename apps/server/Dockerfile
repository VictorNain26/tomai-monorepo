# The server's image: Bun, the two bundles, the migrations and the web build, nothing else.
# `bun build` bundles every dependency (the bundles load with no node_modules), so the last stage
# copies none. Bases pinned by digest; Renovate bumps them.

# Stage 1: the apps/web build, served by the server on its own origin. Vite runs on Node
# (docs/etudes/2026-10-06/client-web.md); bun only installs.
FROM node:24-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS web

COPY --from=oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61 /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json ./apps/web/
COPY packages/tokens/package.json ./packages/tokens/
COPY packages/ui/package.json ./packages/ui/
COPY packages/eslint-config/package.json ./packages/eslint-config/
# The web imports only the server's types, which Vite erases: its manifest, for the install.
COPY apps/server/package.json ./apps/server/
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts --filter web

COPY tsconfig.base.json ./
COPY packages/tokens/ ./packages/tokens/
COPY packages/ui/ ./packages/ui/
COPY apps/web/ ./apps/web/
WORKDIR /app/apps/web
RUN bun run build && test -f dist/index.html -a -f dist/sw.js

# Stage 2: the server's bundles. The CI typechecks and lints; this stage only builds.
FROM oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61 AS build

WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/server/package.json ./apps/server/
COPY packages/eslint-config/package.json ./packages/eslint-config/
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts --filter tomai-server

COPY apps/server/src/ ./apps/server/src/
COPY tsconfig.base.json ./
COPY apps/server/tsconfig*.json ./apps/server/
WORKDIR /app/apps/server
# bun build inlines process.env.NODE_ENV: set after the install, which needs the dev dependencies.
ENV NODE_ENV=production
RUN bun run build && test -f dist/main.js -a -f dist/migrate.js -a -f dist/invite.js

# Stage 3: production.
FROM oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61 AS production

ENV NODE_ENV=production
ENV WEB_DIST_DIR=/app/apps/web/dist

WORKDIR /app/apps/server
COPY --from=build --chown=bun:bun /app/apps/server/dist ./dist
COPY --from=web --chown=bun:bun /app/apps/web/dist /app/apps/web/dist
COPY --chown=bun:bun apps/server/drizzle/ ./drizzle/
COPY --chown=bun:bun --chmod=755 apps/server/docker-entrypoint.sh ./docker-entrypoint.sh

# Smoke import: started without an environment, a bundle whose static imports all resolve stops
# on its config; one that needs a module missing from the image stops on "Cannot find module".
RUN bun --no-env-file dist/main.js 2>&1 | grep -q 'Invalid environment' && \
    bun --no-env-file dist/migrate.js 2>&1 | grep -q 'Invalid environment'

USER bun
EXPOSE 3000

# No curl in the image: Bun's own fetch probes liveness.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD ["bun", "-e", "const r = await fetch(`http://localhost:${process.env.PORT ?? 3000}/health/live`); process.exit(r.ok ? 0 : 1)"]

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "--smol", "dist/main.js"]

LABEL org.opencontainers.image.title="tomai-server" \
      org.opencontainers.image.description="Bun + Hono server, serving the web client on its origin" \
      org.opencontainers.image.source="https://github.com/VictorNain26/tomai-monorepo"
