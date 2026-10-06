/**
 * The database connection settings shared by the app's pool, the migrations and the eval, read
 * before the full env schema: migrate.ts runs before boot, without the app's secrets.
 */

/** @throws Error if DATABASE_URL is not set */
export function resolveDatabaseUrl(): string {
  const databaseUrl = Bun.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  return databaseUrl;
}

/**
 * Production requires TLS. Elsewhere the option is left out so that the URL's own `sslmode`
 * decides: postgres.js 3.4 lets an explicit `ssl` option override it.
 */
export function databaseSsl(environment: string): { ssl: 'require' } | Record<string, never> {
  return environment === 'production' ? { ssl: 'require' } : {};
}
