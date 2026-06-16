/**
 * TEST-ONLY — credentials-based Pronote login for integration tests.
 *
 * The public Pronote demo does not issue reusable tokens (loginToken fails),
 * so integration tests that need a live session must bootstrap via username+password.
 * This helper MUST NOT be imported from production code.
 */

import { createSessionHandle, loginCredentials, type AccountKind } from 'pawnote';
import {
  createServerFetcher,
  type AdapterSession,
} from '../../services/pronote/pawnote-server.adapter.js';

export async function loginWithCredentials(input: {
  url: string;
  kind: number;
  username: string;
  password: string;
  deviceUuid: string;
}): Promise<AdapterSession> {
  const handle = createSessionHandle(createServerFetcher());
  const info = await loginCredentials(handle, {
    url: input.url,
    kind: input.kind as AccountKind,
    username: input.username,
    password: input.password,
    deviceUUID: input.deviceUuid,
  });
  return { token: info.token, username: info.username, handle };
}
