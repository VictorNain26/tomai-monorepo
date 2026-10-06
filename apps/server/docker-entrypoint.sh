#!/bin/bash
# TomAI Backend - Docker Entrypoint
# Applies the migrations, then starts the server, which refuses to boot while one is missing.

set -e

echo "🚀 TomAI Backend Starting..."
echo "📍 Environment: ${NODE_ENV:-development}"

# Run database migrations (production + staging)
if [ "$NODE_ENV" != "development" ] && [ -d "./drizzle" ]; then
  MIGRATION_COUNT=$(find ./drizzle -maxdepth 1 -name "*.sql" -type f | wc -l)
  echo "🔄 Running $MIGRATION_COUNT database migrations..."
  bun dist/migrate.js
  echo "✅ Migrations complete"
fi

# Start the server
echo "🎯 Starting server..."
exec "$@"
