import { usersRepository } from '../db/repositories/users.repository.js';
import { subscriptionRepository } from '../db/repositories/subscription.repository.js';

type ChildWithStatus = {
  id: string;
  name: string | null;
  username: string | null;
  plan: string;
  status: string;
};

export type FamilyStatusResult = {
  plan: string;
  status: string;
  billing: {
    premiumChildrenCount: number;
    monthlyAmountCents: number;
    monthlyAmount: string;
    billingStatus: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  } | null;
  children: ChildWithStatus[];
};

export class SubscriptionService {
  async getFamilyStatus(parentId: string): Promise<FamilyStatusResult> {
    const [billing, children] = await Promise.all([
      subscriptionRepository.findFamilyBilling(parentId),
      usersRepository.findAllChildrenByParentId(parentId),
    ]);

    const childIds = children.map((c) => c.id);
    const childSubscriptions = await subscriptionRepository.findChildSubscriptions(childIds);

    const subByUserId = new Map(childSubscriptions.map((row) => [row.userId, row]));

    const childrenWithStatus: ChildWithStatus[] = children.map((child) => {
      const sub = subByUserId.get(child.id);
      return {
        id: child.id,
        name: child.name,
        username: child.username,
        plan: sub?.planName ?? 'free',
        status: sub?.status ?? 'inactive',
      };
    });

    const hasPremium = billing?.premiumChildrenCount && billing.premiumChildrenCount > 0;

    return {
      plan: hasPremium ? 'premium' : 'free',
      status: billing?.billingStatus ?? 'inactive',
      billing: billing
        ? {
            premiumChildrenCount: billing.premiumChildrenCount,
            monthlyAmountCents: billing.monthlyAmountCents,
            monthlyAmount: `${(billing.monthlyAmountCents / 100).toFixed(2)}€`,
            billingStatus: billing.billingStatus,
            currentPeriodStart: billing.currentPeriodStart?.toISOString() ?? null,
            currentPeriodEnd: billing.currentPeriodEnd?.toISOString() ?? null,
          }
        : null,
      children: childrenWithStatus,
    };
  }
}

export const subscriptionService = new SubscriptionService();
