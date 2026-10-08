/**
 * The suite's server has no Scaleway settings: it logs its emails instead of sending them, into
 * this file, where a test reads the code an address was sent.
 */

import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const SERVER_LOG = join(tmpdir(), 'tom-e2e-server.log');

/** The log's complete lines: one still being written waits for its end. */
function lines() {
  const text = existsSync(SERVER_LOG) ? readFileSync(SERVER_LOG, 'utf8') : '';
  return text
    .slice(0, text.lastIndexOf('\n') + 1)
    .split('\n')
    .slice(0, -1);
}

/** Where the log stands: taken before a test asks for a code, so that an older one never counts. */
export const logMark = () => lines().length;

/** The sign-in code logged for `to` since `mark`, or undefined while it has not come. */
export function codeSince(mark: number, to: string): string | undefined {
  for (const line of lines().slice(mark)) {
    if (!line.startsWith('{')) continue;
    const { email } = JSON.parse(line) as { email?: { to: string; subject: string } };
    const code = email?.to === to ? /\b\d{6}\b/.exec(email.subject)?.[0] : undefined;
    if (code) return code;
  }
  return undefined;
}
