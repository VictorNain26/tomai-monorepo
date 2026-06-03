/**
 * Database URL resolution utility (pré-boot, validates independently)
 *
 * This module is imported by connection.ts and migrate.ts to resolve DATABASE_URL
 * without triggering the full env schema validation (which requires prod secrets).
 *
 * Used in two contexts:
 * 1. migrate.ts: Runs before app boot, doesn't have BETTER_AUTH_SECRET, REVENUECAT_WEBHOOK_AUTH, etc.
 * 2. connection.ts: Uses the singleton env, but delegates here to avoid duplication
 */

/**
 * Detects if running in Docker container
 */
function isRunningInDocker(): boolean {
  if (Bun.env['DOCKER_CONTAINER'] === 'true') {
    return true;
  }

  try {
    const fs = require('fs');
    return fs.existsSync('/.dockerenv');
  } catch {
    return false;
  }
}

/**
 * Resolve DATABASE_URL based on Docker context
 * In Docker: use DATABASE_URL (internal hostname)
 * Locally: use DATABASE_URL_EXTERNAL (localhost) if provided, else DATABASE_URL
 *
 * @throws Error if DATABASE_URL is not set
 */
export function resolveDatabaseUrl(): string {
  const databaseUrl = Bun.env['DATABASE_URL'];

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  if (isRunningInDocker()) {
    return databaseUrl;
  }

  // Local development: prefer external URL if available
  const externalUrl = Bun.env['DATABASE_URL_EXTERNAL'];
  return externalUrl ?? databaseUrl;
}
