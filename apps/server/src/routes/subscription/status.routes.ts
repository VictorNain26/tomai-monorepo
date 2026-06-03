/**
 * Status Routes
 *
 * GET /api/subscriptions/status - Get subscription status (DB-driven, RevenueCat as source of truth)
 * GET /api/subscriptions/usage  - Get token usage
 *
 * Security: All routes require authentication and verify caller identity (IDOR protection)
 */

import { Elysia } from 'elysia';
import { authMacro } from '../../lib/auth-macro.js';
import { db } from '../../db/connection.js';
import { user, familyBilling, userSubscriptions, subscriptionPlans } from '../../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { verifyParentIdMatch } from './helpers.js';

export const statusRoutes = new Elysia({ prefix: '/api/subscriptions' })
  .use(authMacro)

  /**
   * Get Subscription Status
   * GET /api/subscriptions/status?parentId=xxx
   *
   * Reads family_billing (populated by RevenueCat webhooks) and joins
   * children's user_subscriptions for plan info. No provider SDK calls.
   *
   * Security: Verifies authenticated user === query.parentId (IDOR protection)
   */
  // Guard: parentAuth required (parent role only)
  .guard({ parentAuth: true })
  .get('/status', async ({ query, set, user: authenticatedUser }) => {
    const parentId = query.parentId;

    if (!parentId) {
      set.status = 400;
      return { error: 'parentId query parameter required' };
    }

    const { valid, error: idorError } = verifyParentIdMatch(authenticatedUser.id, parentId);
    if (!valid) {
      set.status = 403;
      return { error: idorError };
    }

    const [billing] = await db
      .select()
      .from(familyBilling)
      .where(eq(familyBilling.parentId, parentId))
      .limit(1);

    const children = await db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
      })
      .from(user)
      .where(eq(user.parentId, parentId));

    // Single JOIN query for all children (avoids N+1).
    const childIds = children.map((c) => c.id);
    const childSubscriptions = childIds.length > 0
      ? await db
          .select({
            userId: userSubscriptions.userId,
            status: userSubscriptions.status,
            planName: subscriptionPlans.name,
          })
          .from(userSubscriptions)
          .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
          .where(inArray(userSubscriptions.userId, childIds))
      : [];

    const subByUserId = new Map(
      childSubscriptions.map((row) => [row.userId, row]),
    );

    const childrenWithStatus = children.map((child) => {
      const sub = subByUserId.get(child.id);
      return {
        ...child,
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
   *
   * Security: Verifies authenticated user can access this userId:
   * - Self access (userId === authenticatedUser.id)
   * - Parent accessing child (parent viewing their child's usage)
   */
  // Guard: auth required (both parent and child can access their own usage or parent's children's usage)
  .guard({ auth: true })
  .get('/usage', async ({ query, set, user: authenticatedUser }) => {
    const userId = query.userId;

    if (!userId) {
      set.status = 400;
      return { error: 'userId query parameter required' };
    }

    const [userRecord] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!userRecord) {
      set.status = 404;
      return { error: 'User not found' };
    }

    const isSelfAccess = authenticatedUser.id === userId;
    const isParentAccessingChild = authenticatedUser.role === 'parent' && userRecord.parentId === authenticatedUser.id;

    if (!isSelfAccess && !isParentAccessingChild) {
      set.status = 403;
      return { error: 'Access denied: You can only view your own usage or your children\'s usage' };
    }

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
