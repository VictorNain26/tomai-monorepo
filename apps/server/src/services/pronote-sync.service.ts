/**
 * Pronote Credential Sync Service
 *
 * Stores and retrieves AES-256-GCM encrypted Pronote credentials.
 * Two consumers: mobile (device-first, decrypts for direct pawnote calls) and
 * the server-side provider (PawnoteServerAdapter, decrypts in-memory for
 * parent/web reads via pronote-data.service).
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { pronoteCredentials } from '../db/schema.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { logger } from '../lib/observability.js';

interface UpsertInput {
  token: string;
  metadata: string;
  tokenExpiresAt: string;
}

export interface CredentialOutput {
  token: string;
  metadata: string;
  tokenExpiresAt: string;
}

interface UpsertResult {
  success: boolean;
  error?: string;
  credentialId?: string;
}

class PronoteSyncService {
  /**
   * Create or update Pronote credentials for a user+establishment pair.
   * Derives establishmentUrl from metadata.instanceUrl.
   * Returns credentialId on success.
   */
  async upsertCredentials(
    userId: string,
    input: UpsertInput
  ): Promise<UpsertResult> {
    // Validate token
    if (!input.token || input.token.trim().length === 0) {
      return { success: false, error: 'Token cannot be empty' };
    }

    // Validate metadata is valid JSON and extract instanceUrl
    let establishmentUrl: string;
    try {
      const parsed = JSON.parse(input.metadata) as Record<string, unknown>;
      if (typeof parsed.instanceUrl !== 'string' || !parsed.instanceUrl) {
        return { success: false, error: 'Metadata must contain a non-empty instanceUrl' };
      }
      establishmentUrl = parsed.instanceUrl;
    } catch {
      return { success: false, error: 'Metadata must be valid JSON' };
    }

    // Validate tokenExpiresAt is a valid date
    const tokenExpiresAt = new Date(input.tokenExpiresAt);
    if (isNaN(tokenExpiresAt.getTime())) {
      return { success: false, error: 'tokenExpiresAt must be a valid ISO date string' };
    }

    // Encrypt sensitive data
    const encryptedToken = await encrypt(input.token);
    const encryptedMetadata = await encrypt(input.metadata);

    // Atomic upsert keyed on (userId, establishmentUrl) — one credential per parent+school
    const rows = await db
      .insert(pronoteCredentials)
      .values({
        userId,
        establishmentUrl,
        encryptedToken,
        encryptedMetadata,
        tokenExpiresAt,
      })
      .onConflictDoUpdate({
        target: [pronoteCredentials.userId, pronoteCredentials.establishmentUrl],
        set: {
          encryptedToken,
          encryptedMetadata,
          tokenExpiresAt,
          updatedAt: new Date(),
        },
      })
      .returning({ id: pronoteCredentials.id });

    const credentialId = rows[0]?.id;

    logger.info('Pronote credentials upserted', {
      operation: 'pronote-sync:upsert',
      userId,
    });

    return { success: true, credentialId };
  }

  /**
   * Get decrypted Pronote credentials for a user (first found).
   * Returns null if no credentials exist.
   */
  async getCredentials(userId: string): Promise<CredentialOutput | null> {
    const rows = await db
      .select()
      .from(pronoteCredentials)
      .where(eq(pronoteCredentials.userId, userId));

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0]!;

    const token = await decrypt(row.encryptedToken);
    const metadata = await decrypt(row.encryptedMetadata);

    logger.info('Pronote credentials retrieved', {
      operation: 'pronote-sync:get',
      userId,
    });

    return {
      token,
      metadata,
      tokenExpiresAt: row.tokenExpiresAt.toISOString(),
    };
  }

  /**
   * Get decrypted Pronote credentials by credential id.
   * Returns null if not found.
   */
  async getCredentialById(id: string): Promise<(CredentialOutput & { id: string }) | null> {
    const rows = await db
      .select()
      .from(pronoteCredentials)
      .where(eq(pronoteCredentials.id, id));

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0]!;
    const token = await decrypt(row.encryptedToken);
    const metadata = await decrypt(row.encryptedMetadata);

    logger.info('Pronote credentials retrieved by id', {
      operation: 'pronote-sync:get-by-id',
      id,
    });

    return {
      id: row.id,
      token,
      metadata,
      tokenExpiresAt: row.tokenExpiresAt.toISOString(),
    };
  }

  /**
   * Update only the token for a credential identified by id.
   * Re-encrypts the new token before storage.
   */
  async updateTokenById(id: string, token: string): Promise<boolean> {
    const encryptedToken = await encrypt(token);

    const res = await db
      .update(pronoteCredentials)
      .set({ encryptedToken, updatedAt: new Date() })
      .where(eq(pronoteCredentials.id, id))
      .returning({ id: pronoteCredentials.id });

    logger.info('Pronote token updated by id', {
      operation: 'pronote-sync:update-token',
      id,
    });

    return res.length > 0;
  }

  /**
   * Delete Pronote credentials for a user.
   * Returns true regardless of whether credentials existed.
   */
  async deleteCredentials(userId: string): Promise<boolean> {
    await db
      .delete(pronoteCredentials)
      .where(eq(pronoteCredentials.userId, userId));

    logger.info('Pronote credentials deleted', {
      operation: 'pronote-sync:delete',
      userId,
    });

    return true;
  }
}

export const pronoteSyncService = new PronoteSyncService();
