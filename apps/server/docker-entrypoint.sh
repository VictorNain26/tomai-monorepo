#!/bin/sh
# Applies the migrations, then starts the server, which refuses to boot while one is missing.
set -e
bun dist/migrate.js
exec "$@"
