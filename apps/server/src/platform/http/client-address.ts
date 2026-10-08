/**
 * The client's address. Behind the host's proxies, the entry they appended to X-Forwarded-For,
 * counted from the right: the entries before it are whatever the client wrote. Without a proxy,
 * or when that entry is missing or is not an address, the connection's own. Clever Cloud's proxy
 * appends one, after the client's (measured on the staging, 2026-10-08): its FAQ reads the first
 * entry, which a client can write.
 */

import { isIP } from 'node:net';
import { getConnInfo } from '@hono/bun';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from './env';

/** The header the server writes for better-auth, whatever the client sent (platform/auth/auth.ts). */
export const CLIENT_ADDRESS_HEADER = 'x-client-address';

export function addressOf(forwardedFor: string | undefined, connection: string, trustedHops: number): string {
  if (trustedHops === 0 || !forwardedFor) return connection;
  const appended = forwardedFor
    .split(',')
    .map((entry) => entry.trim())
    .at(-trustedHops);
  return appended && isIP(appended) ? appended : connection;
}

export function clientAddress(trustedHops: number) {
  return createMiddleware<AppEnv>(async (c, next) => {
    // Under app.request, in tests, there is no Bun server behind the context and no connection.
    const connection = (c.env ? getConnInfo(c).remote.address : undefined) ?? 'unknown';
    c.set('clientAddress', addressOf(c.req.header('x-forwarded-for'), connection, trustedHops));
    await next();
  });
}
