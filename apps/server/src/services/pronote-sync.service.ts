/**
 * Pronote Credential Sync Service
 *
 * Stores and retrieves AES-256-GCM encrypted Pronote credentials.
 * Single consumer: the server-side provider (PawnoteServerAdapter), which
 * decrypts in-memory for parent/web reads via pronote-data.service.
 */

import { eq, asc, count } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { pronoteCredentials, pronoteChildResources } from '../db/schema.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { logger } from '../lib/observability.js';

// Defined here to avoid importing from pronote-connect.service (which has a heavy
// import chain that conflicts with the drizzle-orm mock in tests).
// The route imports this via pronote-connect.service which re-exports it.
export class PronoteCredentialForbiddenError extends Error {
  constructor() {
    super('This Pronote credential does not belong to the requesting user');
    this.name = 'PronoteCredentialForbiddenError';
  }
}

/**
 * Normalize an establishment URL for use as a deduplication key.
 * Strips trailing slashes and lowercases the host so that
 * "https://x.net/pronote" and "https://x.net/pronote/" resolve to the same key.
 * The raw instanceUrl stored in encrypted metadata is left untouched.
 */
export function normalizeEstablishmentUrl(raw: string): string {
  const u = new URL(raw);
  const host = u.host.toLowerCase();
  const path = u.pathname.replace(/\/+$/, '');
  return `${u.protocol}//${host}${path}`;
}

export interface PronoteCredentialSummary {
  credentialId: string;
  establishmentName: string | null;
  establishmentUrl: string;
  childCount: number;
}

interface UpsertInput {
  token: string;
  metadata: string;
  tokenExpiresAt: string;
  establishmentName?: string | null;
}

interface CredentialOutput {
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
      establishmentUrl = normalizeEstablishmentUrl(parsed.instanceUrl);
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
        establishmentName: input.establishmentName ?? null,
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
          establishmentName: input.establishmentName ?? null,
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
   * Get decrypted Pronote credentials by credential id.
   * Returns null if not found.
   */
  async getCredentialById(id: string): Promise<(CredentialOutput & { id: string; userId: string }) | null> {
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
      userId: row.userId,
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
   * List credential summaries for a user.
   * One row per establishment, with childCount aggregated in a single query.
   * establishmentName is read from the stored column — no live Pronote call.
   */
  async listCredentialSummaries(userId: string): Promise<PronoteCredentialSummary[]> {
    // Aggregate child counts per credential in one query
    const childCounts = await db
      .select({
        credentialId: pronoteChildResources.credentialId,
        childCount: count(pronoteChildResources.id),
      })
      .from(pronoteChildResources)
      .where(eq(pronoteChildResources.parentUserId, userId))
      .groupBy(pronoteChildResources.credentialId);

    const countByCredentialId = new Map<string, number>(
      childCounts
        .filter(r => r.credentialId !== null)
        .map(r => [r.credentialId as string, Number(r.childCount)])
    );

    const creds = await db
      .select({
        id: pronoteCredentials.id,
        establishmentName: pronoteCredentials.establishmentName,
        establishmentUrl: pronoteCredentials.establishmentUrl,
      })
      .from(pronoteCredentials)
      .where(eq(pronoteCredentials.userId, userId))
      .orderBy(asc(pronoteCredentials.createdAt));

    return creds.map(c => ({
      credentialId: c.id,
      establishmentName: c.establishmentName,
      establishmentUrl: c.establishmentUrl,
      childCount: countByCredentialId.get(c.id) ?? 0,
    }));
  }

  /**
   * Delete a single Pronote credential by id.
   * The credential's child resource mappings are removed by CASCADE (DB FK).
   * Child user accounts are NOT touched — they keep their autonomous login.
   *
   * Returns true when deleted. Returns false when the id is not found (route maps 404).
   * Throws PronoteCredentialForbiddenError when userId !== owner (route maps 403).
   */
  async deleteCredentialById(userId: string, credentialId: string): Promise<boolean> {
    const credential = await this.getCredentialById(credentialId);
    if (!credential) {
      return false;
    }
    if (credential.userId !== userId) {
      throw new PronoteCredentialForbiddenError();
    }
    await db
      .delete(pronoteCredentials)
      .where(eq(pronoteCredentials.id, credentialId));

    logger.info('Pronote credential deleted by id', {
      operation: 'pronote-sync:delete-by-id',
      userId,
      credentialId,
    });

    return true;
  }
}

export const pronoteSyncService = new PronoteSyncService();
