import { eq } from 'drizzle-orm';
import { db } from '../connection';
import { pronoteChildResources } from '../schema';

class PronoteChildResourcesRepository {
  async getMapping(
    childUserId: string,
  ): Promise<{ parentUserId: string; resourceId: number } | null> {
    const [row] = await db
      .select({
        parentUserId: pronoteChildResources.parentUserId,
        resourceId: pronoteChildResources.resourceId,
      })
      .from(pronoteChildResources)
      .where(eq(pronoteChildResources.childUserId, childUserId));

    return row ?? null;
  }

  async upsertMapping(
    parentUserId: string,
    childUserId: string,
    resourceId: number,
  ): Promise<void> {
    await db
      .insert(pronoteChildResources)
      .values({ parentUserId, childUserId, resourceId })
      .onConflictDoUpdate({
        target: [pronoteChildResources.parentUserId, pronoteChildResources.childUserId],
        set: { resourceId, updatedAt: new Date() },
      });
  }

  async deleteByChild(childUserId: string): Promise<void> {
    await db
      .delete(pronoteChildResources)
      .where(eq(pronoteChildResources.childUserId, childUserId));
  }
}

export const pronoteChildResourcesRepository = new PronoteChildResourcesRepository();
