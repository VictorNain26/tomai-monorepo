import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuration adaptative selon l'environnement d'exécution
function getDatabaseUrl(): string {
  // Si DATABASE_URL_EXTERNAL existe et qu'on est en dehors de Docker, l'utiliser
  if (process.env.DATABASE_URL_EXTERNAL && !process.env.DOCKER_CONTAINER) {
    console.log('🔗 Using external DATABASE_URL for local development');
    return process.env.DATABASE_URL_EXTERNAL;
  }

  // Sinon, utiliser DATABASE_URL (container ou production)
  if (process.env.DATABASE_URL) {
    console.log('🔗 Using internal DATABASE_URL for container/production');
    return process.env.DATABASE_URL;
  }

  throw new Error('❌ No DATABASE_URL configured. Check your .env file.');
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
