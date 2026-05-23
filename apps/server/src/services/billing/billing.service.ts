/**
 * BillingService — single source of truth for mutations of family_billing
 * and child user_subscriptions rows driven by RevenueCat webhooks.
 *
 * Route handlers parse the webhook payload and call these methods instead of
 * hitting the DB directly, keeping billing logic isolated and testable.
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import { familyBilling, userSubscriptions } from '../../db/schema.js';
import { logger } from '../../lib/observability.js';
import { getFreePlanId, getPremiumPlanId } from '../../lib/plan-cache.js';
import type {
  ActivatePremiumInput,
  ExtendActivePeriodInput,
} from './billing-types.js';

class BillingService {
  /**
   * Activate (or re-activate) the parent's premium subscription and promote
   * all supplied children to the premium plan. Idempotent via upsert.
   */
  async activatePremium(input: ActivatePremiumInput): Promise<void> {
    const {
      parentId,
      childrenIds,
      period,
      monthlyAmountCents,
      premiumChildrenCount,
      source,
    } = input;

    const providerCols = {
      revenuecatCustomerId: source.customerId,
      revenuecatSubscriptionId: source.productId,
    };

    const billingValues = {
      parentId,
      ...providerCols,
      billingStatus: 'active' as const,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      ...(monthlyAmountCents !== undefined && { monthlyAmountCents }),
      ...(premiumChildrenCount !== undefined && { premiumChildrenCount }),
    };

    await db
      .insert(familyBilling)
      .values(billingValues)
      .onConflictDoUpdate({
        target: familyBilling.parentId,
        set: {
          ...providerCols,
          billingStatus: 'active',
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          ...(monthlyAmountCents !== undefined && { monthlyAmountCents }),
          ...(premiumChildrenCount !== undefined && { premiumChildrenCount }),
          updatedAt: new Date(),
        },
      });

    if (childrenIds.length > 0) {
      const premiumPlanId = await getPremiumPlanId();
      if (premiumPlanId) {
        for (const childId of childrenIds) {
          await db
            .insert(userSubscriptions)
            .values({
              userId: childId,
              planId: premiumPlanId,
              status: 'active',
              tokensUsedToday: 0,
            })
            .onConflictDoUpdate({
              target: userSubscriptions.userId,
              set: {
                planId: premiumPlanId,
                status: 'active',
                updatedAt: new Date(),
              },
            });
        }
      }
    }

    logger.info(`[Billing] Activated premium for parent ${parentId}`, {
      operation: 'billing:activate',
      parentId,
      provider: source.provider,
      childrenCount: childrenIds.length,
    });
  }

  /**
   * Extend the active period (renewal). Children are kept on the premium
   * plan; counters are optionally reset on period boundary.
   */
  async extendActivePeriod(input: ExtendActivePeriodInput): Promise<void> {
    const { parentId, childrenIds, period, resetChildCounters } = input;

    await db
      .update(familyBilling)
      .set({
        billingStatus: 'active',
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        updatedAt: new Date(),
      })
      .where(eq(familyBilling.parentId, parentId));

    if (childrenIds.length > 0) {
      await db
        .update(userSubscriptions)
        .set({
          status: 'active',
          ...(resetChildCounters && {
            lastResetAt: new Date(),
            tokensUsedToday: 0,
          }),
          updatedAt: new Date(),
        })
        .where(inArray(userSubscriptions.userId, childrenIds));
    }

    logger.info(`[Billing] Extended active period for parent ${parentId}`, {
      operation: 'billing:extend',
      parentId,
      childrenCount: childrenIds.length,
      resetChildCounters,
    });
  }

  /**
   * Mark the parent's billing as past_due (payment failed but subscription
   * not yet terminated). Children are paused until payment succeeds.
   */
  async markPastDue(parentId: string, childrenIds: string[]): Promise<void> {
    await db
      .update(familyBilling)
      .set({
        billingStatus: 'past_due',
        updatedAt: new Date(),
      })
      .where(eq(familyBilling.parentId, parentId));

    if (childrenIds.length > 0) {
      await db
        .update(userSubscriptions)
        .set({
          status: 'paused',
          updatedAt: new Date(),
        })
        .where(inArray(userSubscriptions.userId, childrenIds));
    }

    logger.warn(`[Billing] Past due for parent ${parentId}`, {
      operation: 'billing:past-due',
      parentId,
      childrenPaused: childrenIds.length,
      severity: 'medium' as const,
    });
  }

  /**
   * Cancel-at-period-end marker. Parent paid for the current period and
   * keeps access; no child mutation until expireAndDowngrade fires.
   */
  async markCanceled(parentId: string): Promise<void> {
    await db
      .update(familyBilling)
      .set({
        billingStatus: 'canceled',
        updatedAt: new Date(),
      })
      .where(eq(familyBilling.parentId, parentId));

    logger.info(`[Billing] Marked canceled (pending) for parent ${parentId}`, {
      operation: 'billing:cancel',
      parentId,
    });
  }

  /**
   * User undid a pending cancellation — reactivate.
   */
  async markUncanceled(parentId: string): Promise<void> {
    await db
      .update(familyBilling)
      .set({
        billingStatus: 'active',
        updatedAt: new Date(),
      })
      .where(eq(familyBilling.parentId, parentId));

    logger.info(`[Billing] Uncanceled for parent ${parentId}`, {
      operation: 'billing:uncancel',
      parentId,
    });
  }

  /**
   * Subscription actually ended — parent goes to expired, children switch
   * to free plan.
   */
  async expireAndDowngrade(
    parentId: string,
    childrenIds: string[],
  ): Promise<void> {
    await db
      .update(familyBilling)
      .set({
        billingStatus: 'expired',
        premiumChildrenCount: 0,
        monthlyAmountCents: 0,
        updatedAt: new Date(),
      })
      .where(eq(familyBilling.parentId, parentId));

    if (childrenIds.length > 0) {
      const freePlanId = await getFreePlanId();
      if (freePlanId) {
        await db
          .update(userSubscriptions)
          .set({
            planId: freePlanId,
            status: 'active',
            tokensUsedToday: 0,
            updatedAt: new Date(),
          })
          .where(inArray(userSubscriptions.userId, childrenIds));
      }
    }

    logger.info(`[Billing] Expired for parent ${parentId}`, {
      operation: 'billing:expire',
      parentId,
      childrenDowngraded: childrenIds.length,
    });
  }
}

export const billingService = new BillingService();
