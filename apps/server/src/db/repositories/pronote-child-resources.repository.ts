import { eq } from 'drizzle-orm';
import { db } from '../connection';
import { pronoteChildResources } from '../schema';

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
      .where(eq(pronoteChildResources.childUserId, childUserId));

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

  async getResourceIdsByCredential(credentialId: string): Promise<number[]> {
    const rows = await db
      .select({ resourceId: pronoteChildResources.resourceId })
      .from(pronoteChildResources)
      .where(eq(pronoteChildResources.credentialId, credentialId));

    return rows.map((r) => r.resourceId);
  }
}

export const pronoteChildResourcesRepository = new PronoteChildResourcesRepository();
