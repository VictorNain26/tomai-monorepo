/**
 * The database: postgres.js under Drizzle. In production the TLS certificate and host name are
 * verified: postgres.js 3.4 only turns verification off for 'require', 'allow' and 'prefer'.
 * Against the system's authorities, or against `ca` for a database whose certificate is its own
 * authority, as Clever Cloud signs each Postgres it hosts. Elsewhere the URL's own `sslmode`
 * decides, unless a `ca` is given.
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

export interface Database {
  db: Db;
  close: () => Promise<void>;
}

export interface DbOptions {
  production: boolean;
  /** The PEM certificate the server's must chain to, its host name checked as well. */
  ca?: string | undefined;
  max?: number;
}

export function createDb(url: string, { production, ca, max }: DbOptions): Database {
  const ssl = ca === undefined ? (production ? 'verify-full' : undefined) : { ca };
  const client = postgres(url, {
    ...(ssl === undefined ? {} : { ssl }),
    ...(max === undefined ? {} : { max }),
    onnotice: () => undefined,
  });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}
