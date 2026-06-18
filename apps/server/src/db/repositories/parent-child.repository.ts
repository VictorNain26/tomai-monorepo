import { and, eq } from 'drizzle-orm';
import { db } from '../connection';
import { parentChild } from '../schema';

class ParentChildRepository {
  async link(parentUserId: string, childUserId: string): Promise<void> {
    await db
      .insert(parentChild)
      .values({ parentUserId, childUserId })
      .onConflictDoNothing();
  }

  async unlink(parentUserId: string, childUserId: string): Promise<void> {
    await db
      .delete(parentChild)
      .where(
        and(
          eq(parentChild.parentUserId, parentUserId),
          eq(parentChild.childUserId, childUserId),
        ),
      );
  }

  async getChildIds(parentUserId: string): Promise<string[]> {
    const rows = await db
      .select({ childUserId: parentChild.childUserId })
      .from(parentChild)
      .where(eq(parentChild.parentUserId, parentUserId));
    return rows.map((r) => r.childUserId);
  }

  async getParentIds(childUserId: string): Promise<string[]> {
    const rows = await db
      .select({ parentUserId: parentChild.parentUserId })
      .from(parentChild)
      .where(eq(parentChild.childUserId, childUserId));
    return rows.map((r) => r.parentUserId);
  }
}

export const parentChildRepository = new ParentChildRepository();
