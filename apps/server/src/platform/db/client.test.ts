/**
 * The TLS choice of the database client, against the test server, which has no TLS: a pinned
 * certificate makes it mandatory, so a server without TLS is refused instead of reached in clear.
 */

import { describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { serverUrl } from '../../testing/database';
import { createDb } from './client';

// A self-signed certificate, made for the test: BoringSSL refuses a malformed one before connecting.
const ca = Bun.spawnSync([
  'openssl',
  'req',
  '-x509',
  '-newkey',
  'ec',
  '-pkeyopt',
  'ec_paramgen_curve:prime256v1',
  '-nodes',
  '-keyout',
  '/dev/null',
  '-days',
  '1',
  '-subj',
  '/CN=tom-test',
]).stdout.toString();

describe('createDb', () => {
  it('reaches a server without TLS when nothing asks for it', async () => {
    const database = createDb(serverUrl('postgres'), { production: false });
    expect([...(await database.db.execute(sql`select 1 as one`))]).toEqual([{ one: 1 }]);
    await database.close();
  });

  it('refuses a server without TLS once a certificate is pinned', async () => {
    const database = createDb(serverUrl('postgres'), { production: false, ca });
    const failure = await database.db.execute(sql`select 1`).then(
      () => undefined,
      (error: unknown) => (error instanceof Error ? String(error.cause) : String(error)),
    );
    expect(failure).toContain('TLS');
    await database.close();
  });
});
