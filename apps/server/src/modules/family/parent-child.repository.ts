import { and, eq } from 'drizzle-orm';
import { db } from '../../db/connection';
import { parentChild } from './family.schema.js';

class ParentChildRepository {
  async link(parentUserId: string, childUserId: string): Promise<void> {
    await db.insert(parentChild).values({ parentUserId, childUserId }).onConflictDoNothing();
  }

  async getChildIds(parentUserId: string): Promise<string[]> {
    const rows = await db.select({ childUserId: parentChild.childUserId }).from(parentChild).where(eq(parentChild.parentUserId, parentUserId));
    return rows.map((r) => r.childUserId);
  }

  async isLinked(parentUserId: string, childUserId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: parentChild.id })
      .from(parentChild)
      .where(and(eq(parentChild.parentUserId, parentUserId), eq(parentChild.childUserId, childUserId)))
      .limit(1);
    return Boolean(row);
  }
}

export const parentChildRepository = new ParentChildRepository();
