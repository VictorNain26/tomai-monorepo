import { defineConfig } from 'drizzle-kit';

// drizzle-kit generate needs no connection: the placeholder lets it run without a database.
export default defineConfig({
  out: './drizzle',
  schema: './src/platform/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
  strict: true,
});
