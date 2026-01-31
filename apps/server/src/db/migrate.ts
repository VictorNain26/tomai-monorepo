/**
 * Drizzle Migration Runner
 * Best Practice 2026: Programmatic migrations for production deployments
 *
 * Usage:
 * - Development: pnpm db:push (direct sync - fast iteration)
 * - Production: pnpm db:migrate (versioned migrations - safe deployments)
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is required for migrations');
    process.exit(1);
  }

  console.log('🔄 Running database migrations...');

  // Create a dedicated connection for migrations (max 1 connection)
  const migrationClient = postgres(databaseUrl, {
    max: 1,
    ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  });
  const db = drizzle(migrationClient);

  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
