/**
 * Backfill: populate establishment_url from encrypted metadata for existing rows.
 *
 * Run BEFORE db:push (which makes establishment_url NOT NULL):
 *   cd apps/server && bun run src/db/backfill-establishment-url.ts && bun run db:push
 */

import { isNull, eq } from 'drizzle-orm';
import { db } from './connection.js';
import { pronoteCredentials } from './schema.js';
import { decrypt } from '../lib/encryption.js';

async function backfill(): Promise<void> {
  const rows = await db
    .select()
    .from(pronoteCredentials)
    .where(isNull(pronoteCredentials.establishmentUrl));

  console.log(`Found ${rows.length} row(s) missing establishment_url.`);

  let done = 0;
  for (const row of rows) {
    const meta = JSON.parse(await decrypt(row.encryptedMetadata)) as { instanceUrl?: string };
    if (!meta.instanceUrl) {
      console.warn(`Skip ${row.id}: no instanceUrl in metadata`);
      continue;
    }
    await db
      .update(pronoteCredentials)
      .set({ establishmentUrl: meta.instanceUrl })
      .where(eq(pronoteCredentials.id, row.id));
    done += 1;
  }

  console.log(`Done: ${done}/${rows.length} rows updated.`);
}

backfill().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
