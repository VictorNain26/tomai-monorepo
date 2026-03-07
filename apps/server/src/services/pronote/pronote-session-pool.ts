import {
  createSessionHandle,
  loginToken,
  AccountKind,
  type SessionHandle,
} from 'pawnote';
import { db } from '../../db/connection.js';
import { pronoteConnections } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '../../lib/encryption.js';
import { logger } from '../../lib/observability.js';
import {
  TOKEN_EXPIRY_MS,
  TOKEN_REFRESH_BUFFER_MS,
  SESSION_POOL_TTL_MS,
  pronoteFetcher,
  type SessionPoolEntry,
} from './pronote-shared.js';

const sessionPool = new Map<string, SessionPoolEntry>();

export function getPooledSession(connectionId: string): SessionHandle | null {
  const entry = sessionPool.get(connectionId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessionPool.delete(connectionId);
    return null;
  }
  return entry.session;
}

export function setPooledSession(connectionId: string, session: SessionHandle): void {
  sessionPool.set(connectionId, {
    session,
    expiresAt: Date.now() + SESSION_POOL_TTL_MS,
  });
}

export function removePooledSession(connectionId: string): void {
  sessionPool.delete(connectionId);
}

export async function createSessionFromConnection(
  connection: typeof pronoteConnections.$inferSelect
): Promise<SessionHandle | null> {
  const pooled = getPooledSession(connection.id);
  if (pooled) return pooled;

  const now = new Date();
  const shouldRefresh =
    connection.tokenExpiresAt.getTime() - now.getTime() < TOKEN_REFRESH_BUFFER_MS;

  let token: string;
  try {
    token = await decrypt(connection.encryptedToken);
  } catch (error) {
    logger.error('Pronote token decryption failed', {
      operation: 'pronote:decrypt:error',
      connectionId: connection.id,
      _error: error instanceof Error ? error.message : String(error),
      severity: 'high' as const,
    });
    await db
      .update(pronoteConnections)
      .set({ status: 'error', lastError: 'Token déchiffrement échoué' })
      .where(eq(pronoteConnections.id, connection.id));
    return null;
  }

  const session = createSessionHandle(pronoteFetcher);

  try {
    if (shouldRefresh) {
      const refreshInfo = await loginToken(session, {
        url: connection.instanceUrl,
        kind: connection.accountKind as AccountKind,
        username: connection.pronoteUsername,
        token,
        deviceUUID: connection.deviceUuid,
      });

      const newEncryptedToken = await encrypt(refreshInfo.token);
      const newExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

      await db
        .update(pronoteConnections)
        .set({
          encryptedToken: newEncryptedToken,
          tokenExpiresAt: newExpiresAt,
          lastRefreshAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(pronoteConnections.id, connection.id));

      logger.debug('Pronote token refreshed', {
        operation: 'pronote:refresh',
        connectionId: connection.id,
      });
    } else {
      await loginToken(session, {
        url: connection.instanceUrl,
        kind: connection.accountKind as AccountKind,
        username: connection.pronoteUsername,
        token,
        deviceUUID: connection.deviceUuid,
      });
    }

    setPooledSession(connection.id, session);
    return session;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db
      .update(pronoteConnections)
      .set({
        status: 'expired',
        lastError: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(pronoteConnections.id, connection.id));

    logger.warn('Pronote session expired', {
      operation: 'pronote:session:expired',
      connectionId: connection.id,
      error: errorMessage,
    });

    return null;
  }
}
