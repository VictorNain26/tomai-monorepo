import { defineConfig } from 'drizzle-kit';

// Bun charge automatiquement les fichiers .env — pas besoin de dotenv.

// drizzle-kit generate needs no connection: a placeholder lets it run without a database.
function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
}

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  // Mode développement - permet push direct
  verbose: true,
  strict: true,
});
