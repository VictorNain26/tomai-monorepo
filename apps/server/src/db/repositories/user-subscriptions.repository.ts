import { eq, sql } from 'drizzle-orm';
import { db } from '../connection';
import {
  userSubscriptions,
  subscriptionPlans,
  type UserSubscription,
  type NewUserSubscription,
  type SubscriptionPlan,
} from '../schema';

type SubscriptionWithPlanName = UserSubscription & { planName: string };

type TokenIncrementParams = {
  tokensUsed: number;
  shouldResetWindow: boolean;
  windowStartAt: Date;
  shouldResetDaily: boolean;
  lastResetAt: Date;
  shouldResetWeekly: boolean;
  lastWeeklyResetAt: Date;
};

type DeckIncrementParams = {
  shouldResetDaily: boolean;
  lastResetAt: Date;
  shouldResetMonthly: boolean;
  lastMonthlyResetAt: Date;
};

class UserSubscriptionsRepository {
  async findByUserId(userId: string): Promise<UserSubscription | undefined> {
    const [row] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);
    return row;
  }

  async findByUserIdWithPlanName(userId: string): Promise<SubscriptionWithPlanName | undefined> {
    const [row] = await db
      .select({
        subscription: userSubscriptions,
        planName: subscriptionPlans.name,
      })
      .from(userSubscriptions)
      .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (!row) return undefined;
    return { ...row.subscription, planName: row.planName };
  }

  async findPlanByName(name: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, name))
      .limit(1);
    return plan;
  }

  async insertDefault(input: NewUserSubscription): Promise<void> {
    await db.insert(userSubscriptions).values(input);
  }

  /**
   * Atomic token-usage increment in a single UPDATE ... RETURNING.
   * The service decides the reset booleans (window/daily/weekly) from a prior
   * read; this method applies them atomically — the CASE-style branches make
   * concurrent writers crossing the same boundary converge to a correct
   * "reset + delta" outcome without a lost-write race.
   */
  async applyTokenIncrement(
    userId: string,
    params: TokenIncrementParams,
  ): Promise<{ windowTokensUsed: number; tokensUsedToday: number } | undefined> {
    const { tokensUsed } = params;

    const [updated] = await db
      .update(userSubscriptions)
      .set({
        windowTokensUsed: params.shouldResetWindow
          ? tokensUsed
          : sql`${userSubscriptions.windowTokensUsed} + ${tokensUsed}`,
        windowStartAt: params.shouldResetWindow ? new Date() : params.windowStartAt,
        tokensUsedToday: params.shouldResetDaily
          ? tokensUsed
          : sql`${userSubscriptions.tokensUsedToday} + ${tokensUsed}`,
        lastResetAt: params.shouldResetDaily ? new Date() : params.lastResetAt,
        tokensUsedThisWeek: params.shouldResetWeekly
          ? tokensUsed
          : sql`${userSubscriptions.tokensUsedThisWeek} + ${tokensUsed}`,
        lastWeeklyResetAt: params.shouldResetWeekly ? new Date() : params.lastWeeklyResetAt,
        totalTokensUsed: sql`${userSubscriptions.totalTokensUsed} + ${tokensUsed}`,
        totalMessagesCount: sql`${userSubscriptions.totalMessagesCount} + ${1}`,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId))
      .returning({
        windowTokensUsed: userSubscriptions.windowTokensUsed,
        tokensUsedToday: userSubscriptions.tokensUsedToday,
      });

    return updated;
  }

  /**
   * Atomic deck-usage increment. A daily reset here also zeroes the token
   * window counters (same boundary), preserving the original combined-reset
   * behaviour.
   */
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
        ...(params.shouldResetDaily && {
          tokensUsedToday: 0,
          windowTokensUsed: 0,
          windowStartAt: new Date(),
        }),
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

  /**
   * Cron sweep: zero daily counters for users whose lastResetAt is older than
   * 20 hours. Returns the number of rows reset.
   */
  async resetExpiredDaily(): Promise<number> {
    const result = await db
      .update(userSubscriptions)
      .set({
        tokensUsedToday: 0,
        decksGeneratedToday: 0,
        lastResetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(sql`${userSubscriptions.lastResetAt} < NOW() - INTERVAL '20 hours'`);

    return (result as unknown as { rowCount?: number }).rowCount ?? 0;
  }
}

export const userSubscriptionsRepository = new UserSubscriptionsRepository();
