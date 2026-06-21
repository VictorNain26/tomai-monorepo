import { eq, inArray, and } from 'drizzle-orm';
import { db } from '../connection';
import { pronoteChildResources } from '../schema';
import type { PronoteChildStatus } from '../../services/pronote/provider.types.js';

class PronoteChildResourcesRepository {
  async getMapping(
    childUserId: string,
  ): Promise<{ parentUserId: string; credentialId: string; resourceId: number } | null> {
    const [row] = await db
      .select({
        parentUserId: pronoteChildResources.parentUserId,
        credentialId: pronoteChildResources.credentialId,
        resourceId: pronoteChildResources.resourceId,
      })
      .from(pronoteChildResources)
      .where(eq(pronoteChildResources.childUserId, childUserId))
      .limit(1);

    if (!row || row.credentialId === null) return null;
    return { parentUserId: row.parentUserId, credentialId: row.credentialId, resourceId: row.resourceId };
  }

  async upsertMapping(
    parentUserId: string,
    childUserId: string,
    credentialId: string,
    resourceId: number,
    className: string | null,
    establishmentName: string | null,
  ): Promise<void> {
    await db
      .insert(pronoteChildResources)
      .values({ parentUserId, childUserId, credentialId, resourceId, className, establishmentName })
      .onConflictDoUpdate({
        target: [pronoteChildResources.parentUserId, pronoteChildResources.childUserId],
        set: { credentialId, resourceId, className, establishmentName, updatedAt: new Date() },
      });
  }

  async deleteByChild(childUserId: string): Promise<void> {
    await db
      .delete(pronoteChildResources)
      .where(eq(pronoteChildResources.childUserId, childUserId));
  }

  async getStatusByChild(childUserId: string): Promise<PronoteChildStatus> {
    const [row] = await db
      .select({
        establishmentName: pronoteChildResources.establishmentName,
        className: pronoteChildResources.className,
      })
      .from(pronoteChildResources)
      .where(eq(pronoteChildResources.childUserId, childUserId))
      .limit(1);

    if (!row) {
      return { hasPronote: false, establishmentName: null, className: null };
    }
    return {
      hasPronote: true,
      establishmentName: row.establishmentName ?? null,
      className: row.className ?? null,
    };
  }

  async getMappedChildIds(childIds: string[]): Promise<Set<string>> {
    if (childIds.length === 0) return new Set();
    const rows = await db
      .select({ childUserId: pronoteChildResources.childUserId })
      .from(pronoteChildResources)
      .where(inArray(pronoteChildResources.childUserId, childIds));
    return new Set(rows.map(r => r.childUserId));
  }

  async getCredentialIdByChild(
    parentUserId: string,
    childIds: string[],
  ): Promise<Map<string, string>> {
    if (childIds.length === 0) return new Map();
    const rows = await db
      .select({
        childUserId: pronoteChildResources.childUserId,
        credentialId: pronoteChildResources.credentialId,
      })
      .from(pronoteChildResources)
      .where(
        and(
          eq(pronoteChildResources.parentUserId, parentUserId),
          inArray(pronoteChildResources.childUserId, childIds),
        ),
      );
    return new Map(
      rows
        .filter(r => r.credentialId !== null)
        .map(r => [r.childUserId, r.credentialId as string]),
    );
  }

  async getResourceIdsByCredential(credentialId: string): Promise<number[]> {
    const rows = await db
      .select({ resourceId: pronoteChildResources.resourceId })
      .from(pronoteChildResources)
      .where(eq(pronoteChildResources.credentialId, credentialId));

    return rows.map((r) => r.resourceId);
  }
}

export const pronoteChildResourcesRepository = new PronoteChildResourcesRepository();
