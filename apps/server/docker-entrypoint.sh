#!/bin/bash
# TomAI Backend - Docker Entrypoint
# Best Practice 2026: Run migrations before starting server

set -e

echo "🚀 TomAI Backend Starting..."
echo "📍 Environment: ${NODE_ENV:-development}"

# Run database migrations (production + staging)
if [ "$NODE_ENV" != "development" ] && [ -d "./drizzle" ]; then
  echo "🔄 Running database migrations..."
  bun run src/db/migrate.ts
  echo "✅ Migrations complete"
fi

# Start the server
echo "🎯 Starting server..."
exec "$@"
