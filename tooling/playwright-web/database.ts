/**
 * The suite's own database, recreated each run: locally the Postgres of docker-compose.yml, in CI
 * the job's. A test reads or sets in it what no screen gives, such as a confirmed address, whose
 * link the suite's server only logs, or an invitation, which the server's own command makes.
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import postgres from 'postgres';

export const DATABASE_URL = process.env['E2E_DATABASE_URL'] ?? 'postgresql://tomai_dev:tomai_dev_password@localhost:5432/tom_e2e';

/** Marks the address confirmed, as its link would. */
export async function confirmEmail(email: string) {
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => undefined });
  try {
    await sql`update "user" set email_verified = true where email = ${email}`;
  } finally {
    await sql.end();
  }
}

/** Invites the address, as an operator does, by the built server's command. */
export function invite(email: string) {
  execFileSync('bun', ['--no-env-file', 'dist/invite.js', email], {
    cwd: resolve(import.meta.dirname, '../../apps/server'),
    env: { ...process.env, DATABASE_URL },
    stdio: 'pipe',
  });
}
