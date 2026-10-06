import { and, eq, gte, sum } from 'drizzle-orm';
import { db } from '../../db/connection';
import { costTracking, userSubscriptions, type UserSubscription } from '../../db/schema';

class UserSubscriptionsRepository {
  async findByUserId(userId: string): Promise<UserSubscription | undefined> {
    const [row] = await db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId)).limit(1);
    return row;
  }

  /** What the user's AI calls cost since `since`, in micro-euros (`cost_tracking`). */
  async spentSince(userId: string, since: Date): Promise<number> {
    const [row] = await db
      .select({ spent: sum(costTracking.costMicroEur).mapWith(Number) })
      .from(costTracking)
      .where(and(eq(costTracking.userId, userId), gte(costTracking.createdAt, since)));
    return row?.spent ?? 0;
  }
}

export const userSubscriptionsRepository = new UserSubscriptionsRepository();
