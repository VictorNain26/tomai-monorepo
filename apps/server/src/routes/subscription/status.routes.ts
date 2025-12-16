/**
 * Status Routes
 *
 * GET /api/subscriptions/status - Get subscription status
 * GET /api/subscriptions/portal - Access Customer Portal
 * GET /api/subscriptions/usage - Get token usage
 */

import { Elysia } from 'elysia';
import { stripeService } from '../../lib/stripe/index.js';
import { db } from '../../db/connection.js';
import { user, familyBilling, userSubscriptions, subscriptionPlans } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { verifyParent } from './helpers.js';

export const statusRoutes = new Elysia({ prefix: '/api/subscriptions' })
  /**
   * Create Customer Portal Session
   * GET /api/subscriptions/portal?parentId=xxx
   */
  .get('/portal', async ({ query, set }) => {
    const parentId = query.parentId;

    if (!parentId) {
      set.status = 400;
      return { error: 'parentId query parameter required' };
    }

    // Verify parent
    const { isParent, error } = await verifyParent(parentId);
    if (!isParent) {
      set.status = 403;
      return { error };
    }

    try {
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
      const session = await stripeService.createPortalSession({
        parentId,
        returnUrl: `${frontendUrl}/account`,
      });

      return { url: session.url };
    } catch (err) {
      set.status = 404;
      return { error: err instanceof Error ? err.message : 'Portal session failed' };
    }
  })

  /**
   * Get Subscription Status
   * GET /api/subscriptions/status?parentId=xxx
   *
   * Returns subscription status for a parent, including all premium children.
   */
  .get('/status', async ({ query, set }) => {
    const parentId = query.parentId;

    if (!parentId) {
      set.status = 400;
      return { error: 'parentId query parameter required' };
    }

    // Verify parent exists
    const [parentRecord] = await db
      .select()
      .from(user)
      .where(eq(user.id, parentId))
      .limit(1);

    if (!parentRecord) {
      set.status = 404;
      return { error: 'User not found' };
    }

    // Get billing info
    const [billing] = await db
      .select()
      .from(familyBilling)
      .where(eq(familyBilling.parentId, parentId))
      .limit(1);

    // Get subscription details from Stripe
    const subscriptionInfo = await stripeService.getSubscriptionStatus(parentId);

    // Get all children with their subscription status
    const children = await db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
      })
      .from(user)
      .where(eq(user.parentId, parentId));

    // Get children's subscription status
    const childrenWithStatus = await Promise.all(
      children.map(async (child) => {
        const [childSub] = await db
          .select({
            planId: userSubscriptions.planId,
            status: userSubscriptions.status,
          })
          .from(userSubscriptions)
          .where(eq(userSubscriptions.userId, child.id))
          .limit(1);

        // Get plan name
        let planName = 'free';
        if (childSub?.planId) {
          const [plan] = await db
            .select({ name: subscriptionPlans.name })
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, childSub.planId))
            .limit(1);
          planName = plan?.name ?? 'free';
        }

        return {
          ...child,
          plan: planName,
          status: childSub?.status ?? 'inactive',
        };
      })
    );

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
          }
        : null,
      subscription: subscriptionInfo
        ? {
            id: subscriptionInfo.subscriptionId,
            status: subscriptionInfo.status,
            currentPeriodStart: subscriptionInfo.currentPeriodStart.toISOString(),
            currentPeriodEnd: subscriptionInfo.currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: subscriptionInfo.cancelAtPeriodEnd,
            // Schedule info for pending changes
            hasScheduledChanges: subscriptionInfo.hasScheduledChanges ?? false,
            scheduledChildrenCount: subscriptionInfo.scheduledChildrenCount,
            scheduledMonthlyAmountCents: subscriptionInfo.scheduledMonthlyAmountCents,
            pendingRemovalChildrenIds: subscriptionInfo.pendingRemovalChildrenIds ?? [],
          }
        : null,
      children: childrenWithStatus,
    };
  })

  /**
   * Get Token Usage for a User (Child or Parent viewing child)
   * GET /api/subscriptions/usage?userId=xxx
   *
   * Returns comprehensive token usage with rolling window (5h) + daily cap.
   * Architecture 2025 inspirée de ChatGPT/Claude:
   * - Rolling window 5h: quota se recharge progressivement
   * - Daily cap: limite max journalière (10h Paris reset)
   * - Weekly stats: pour dashboard parent
   */
  .get('/usage', async ({ query, set }) => {
    const userId = query.userId;

    if (!userId) {
      set.status = 400;
      return { error: 'userId query parameter required' };
    }

    // Get user info
    const [userRecord] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!userRecord) {
      set.status = 404;
      return { error: 'User not found' };
    }

    // Use token quota service for accurate server-side tracking
    const { tokenQuotaService } = await import('../../services/token-quota.service.js');
    const usage = await tokenQuotaService.getUsageStats(userId);

    return {
      userId,
      plan: usage.plan,

      // Rolling window (5h) - primary display
      window: {
        tokensUsed: usage.windowTokensUsed,
        tokensRemaining: usage.windowTokensRemaining,
        limit: usage.windowLimit,
        usagePercent: usage.windowUsagePercent,
        refreshIn: usage.windowRefreshIn,
      },

      // Daily cap (reset 10h Paris) - secondary
      daily: {
        tokensUsed: usage.dailyTokensUsed,
        tokensRemaining: usage.dailyTokensRemaining,
        limit: usage.dailyLimit,
        usagePercent: usage.dailyUsagePercent,
        resetsIn: usage.dailyResetsIn,
      },

      // Weekly stats (for parent dashboard)
      weekly: {
        tokensUsed: usage.weeklyTokensUsed,
      },

      // Lifetime stats
      lifetime: {
        totalTokensUsed: usage.totalTokensUsed,
        totalMessagesCount: usage.totalMessagesCount,
      },

      // Legacy format (backward compatibility)
      usage: {
        tokensUsed: usage.dailyTokensUsed,
        tokensRemaining: usage.dailyTokensRemaining,
        dailyLimit: usage.dailyLimit,
        usagePercentage: usage.dailyUsagePercent,
        lastResetAt: new Date().toISOString(),
        resetsIn: usage.dailyResetsIn,
      },
    };
  });
