/**
 * The database: postgres.js under Drizzle. In production the TLS certificate and host name are
 * verified: postgres.js 3.4 only turns verification off for 'require', 'allow' and 'prefer'.
 * Elsewhere the URL's own `sslmode` decides.
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

export interface Database {
  db: Db;
  close: () => Promise<void>;
}

export function createDb(url: string, { production, max }: { production: boolean; max?: number }): Database {
  const client = postgres(url, {
    ...(production ? { ssl: 'verify-full' } : {}),
    ...(max === undefined ? {} : { max }),
    onnotice: () => undefined,
  });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}
