import { and, eq, gte, sql, sum } from 'drizzle-orm';
import { db } from '../../db/connection';
import { costTracking, userSubscriptions, type UserSubscription } from '../../db/schema';

interface DeckIncrementParams {
  shouldResetDaily: boolean;
  lastResetAt: Date;
  shouldResetMonthly: boolean;
  lastMonthlyResetAt: Date;
}

class UserSubscriptionsRepository {
  async findByUserId(userId: string): Promise<UserSubscription | undefined> {
    const [row] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);
    return row;
  }

  /** The user's row, created with the defaults (Gratuit) the first time it is needed. */
  async ensure(userId: string): Promise<UserSubscription> {
    await db.insert(userSubscriptions).values({ userId }).onConflictDoNothing({ target: userSubscriptions.userId });
    const row = await this.findByUserId(userId);
    if (!row) throw new Error('Subscription not found after insert');
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

  /** Atomic deck-usage increment: concurrent generations cannot lose a write. */
  async applyDeckIncrement(
    userId: string,
    params: DeckIncrementParams,
  ): Promise<{ decksGeneratedToday: number; decksGeneratedThisMonth: number } | undefined> {
    const [updated] = await db
      .update(userSubscriptions)
      .set({
        decksGeneratedToday: params.shouldResetDaily
          ? 1
          : sql`${userSubscriptions.decksGeneratedToday} + ${1}`,
        decksGeneratedThisMonth: params.shouldResetMonthly
          ? 1
          : sql`${userSubscriptions.decksGeneratedThisMonth} + ${1}`,
        lastResetAt: params.shouldResetDaily ? new Date() : params.lastResetAt,
        lastMonthlyResetAt: params.shouldResetMonthly ? new Date() : params.lastMonthlyResetAt,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId))
      .returning({
        decksGeneratedToday: userSubscriptions.decksGeneratedToday,
        decksGeneratedThisMonth: userSubscriptions.decksGeneratedThisMonth,
      });

    return updated;
  }
}

export const userSubscriptionsRepository = new UserSubscriptionsRepository();
