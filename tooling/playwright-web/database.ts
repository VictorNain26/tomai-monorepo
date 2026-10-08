/**
 * The suite's own database, recreated each run: locally the Postgres of docker-compose.yml, in CI
 * the job's. A test sets in it what no screen gives: an invitation, which the server's own command
 * makes.
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export const DATABASE_URL = process.env['E2E_DATABASE_URL'] ?? 'postgresql://tomai_dev:tomai_dev_password@localhost:5432/tom_e2e';

/** Invites the address, as an operator does, by the built server's command. */
export function invite(email: string) {
  execFileSync('bun', ['--no-env-file', 'dist/invite.js', email], {
    cwd: resolve(import.meta.dirname, '../../apps/server'),
    env: { ...process.env, DATABASE_URL },
    stdio: 'pipe',
  });
}
