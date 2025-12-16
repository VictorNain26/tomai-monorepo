import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Configuration - PRODUCTION
 *
 * ⚠️  CRITICAL: Production database configuration
 *
 * Usage:
 *   bun run db:migrate --config=drizzle.config.prod.ts
 *
 * Security:
 *   - Never use db:push in production (use migrations only)
 *   - DATABASE_URL_PROD must be set in environment
 *   - Verbose mode disabled for cleaner logs
 */

function getProductionDatabaseUrl(): string {
  const prodUrl = process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;

  if (!prodUrl) {
    throw new Error(
      '❌ No DATABASE_URL_PROD configured. Required for production operations.\n' +
      'Set DATABASE_URL_PROD in your environment or .env.production file.'
    );
  }

  // Validation: ensure it's not dev database
  if (prodUrl.includes('localhost') || prodUrl.includes('127.0.0.1')) {
    throw new Error(
      '⚠️  DATABASE_URL_PROD points to localhost. This is likely incorrect.\n' +
      'Production should use a remote database (Supabase, RDS, etc.)'
    );
  }

  console.log('🚀 Using production DATABASE_URL');
  console.log('   Host:', new URL(prodUrl).host);

  return prodUrl;
}

export default defineConfig({
  // Output directory for migrations
  out: './drizzle',

  // Schema definition
  schema: './src/db/schema.ts',

  // Database dialect
  dialect: 'postgresql',

  // Production database credentials
  dbCredentials: {
    url: getProductionDatabaseUrl(),
  },

  // Production settings
  verbose: false, // Minimal logs in production
  strict: true,   // Strict mode for safety

  // Migration configuration
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public'
  }
});
