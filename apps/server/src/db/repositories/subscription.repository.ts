import { eq, inArray } from 'drizzle-orm';
import { db } from '../connection';
import { familyBilling, userSubscriptions, subscriptionPlans } from '../schema';

type FamilyBilling = typeof familyBilling.$inferSelect;

type ChildSubscriptionRow = {
  userId: string;
  status: string | null;
  planName: string | null;
};

class SubscriptionRepository {
  async findFamilyBilling(parentId: string): Promise<FamilyBilling | undefined> {
    const [billing] = await db
      .select()
      .from(familyBilling)
      .where(eq(familyBilling.parentId, parentId))
      .limit(1);
    return billing;
  }

  async findChildSubscriptions(childIds: string[]): Promise<ChildSubscriptionRow[]> {
    if (childIds.length === 0) return [];
    return db
      .select({
        userId: userSubscriptions.userId,
        status: userSubscriptions.status,
        planName: subscriptionPlans.name,
      })
      .from(userSubscriptions)
      .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .where(inArray(userSubscriptions.userId, childIds));
  }
}

export const subscriptionRepository = new SubscriptionRepository();
