import { eq } from 'drizzle-orm';
import { db } from '../connection';
import { pronoteChildResources } from '../schema';

class PronoteChildResourcesRepository {
  async getResourceId(childUserId: string): Promise<number | null> {
    const [row] = await db
      .select({ resourceId: pronoteChildResources.resourceId })
      .from(pronoteChildResources)
      .where(eq(pronoteChildResources.childUserId, childUserId));

    return row?.resourceId ?? null;
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
        target: pronoteChildResources.childUserId,
        set: { parentUserId, resourceId, updatedAt: new Date() },
      });
  }

  async deleteByChild(childUserId: string): Promise<void> {
    await db
      .delete(pronoteChildResources)
      .where(eq(pronoteChildResources.childUserId, childUserId));
  }
}

export const pronoteChildResourcesRepository = new PronoteChildResourcesRepository();
