/**
 * `bun run invite <email>` (`bun dist/invite.js <email>` in the image): lets that address create a
 * guardian's account, for 30 days (platform/auth/invitation.ts). It needs the database only.
 */

import { z } from 'zod';
import { loadDatabaseConfig } from './config';
import { invite } from './platform/auth/invitation';
import { createDb } from './platform/db/client';

const email = z.email().safeParse(Bun.argv[2]);
if (!email.success) {
  console.error('Usage : bun run invite <adresse e-mail>');
  process.exit(1);
}

const config = loadDatabaseConfig(Bun.env);
const { db, close } = createDb(config.databaseUrl, { production: config.production, ca: config.databaseCa, max: 1 });
try {
  const { expiresAt } = await invite(db, email.data);
  console.log(`Invitation de ${email.data} valable jusqu'au ${expiresAt.toISOString()}`);
} finally {
  await close();
}
