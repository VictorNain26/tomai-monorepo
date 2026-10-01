/**
 * Subscription Routes
 *
 * GET /api/subscriptions/status - Get subscription status (DB-driven)
 * GET /api/subscriptions/usage  - Get token usage
 *
 * Security: All routes require authentication and verify caller identity (IDOR protection)
 */

import { Hono } from 'hono';
import { requireParent, requireUser, type AppEnv } from '../../platform/http/context.js';
import { subscriptionService } from './subscription.service.js';
import { getUsageStats } from '../billing/index.js';
import { parentChildRepository } from './parent-child.repository.js';

// Mounted under /api/subscriptions by app.ts.
export const subscriptionRoutes = new Hono<AppEnv>()

  .get('/status', requireParent, async (c) => {
    const authenticatedUser = c.var.user;
    const parentId = c.req.query('parentId');

    if (!parentId) {
      return c.json({ error: 'parentId query parameter required' }, 400);
    }

    if (parentId !== authenticatedUser.id) {
      return c.json({ error: 'Access denied: You can only manage your own subscription' }, 403);
    }

    return c.json(await subscriptionService.getFamilyStatus(parentId));
  })

  .get('/usage', requireUser, async (c) => {
    const authenticatedUser = c.var.user;
    const userId = c.req.query('userId');

    if (!userId) {
      return c.json({ error: 'userId query parameter required' }, 400);
    }

    // Access is checked before any lookup: an unknown id answers 403 like a
    // forbidden one, so the route does not reveal which accounts exist.
    const isSelfAccess = authenticatedUser.id === userId;
    const isParentAccessingChild =
      authenticatedUser.role === 'parent' &&
      (await parentChildRepository.isLinked(authenticatedUser.id, userId));

    if (!isSelfAccess && !isParentAccessingChild) {
      return c.json({
        error: "Access denied: You can only view your own usage or your children's usage",
      }, 403);
    }

    const usage = await getUsageStats(userId);

    return c.json({
      userId,
      plan: usage.plan,

      window: {
        tokensUsed: usage.windowTokensUsed,
        tokensRemaining: usage.windowTokensRemaining,
        limit: usage.windowLimit,
        usagePercent: usage.windowUsagePercent,
        refreshIn: usage.windowRefreshIn,
      },

      daily: {
        tokensUsed: usage.dailyTokensUsed,
        tokensRemaining: usage.dailyTokensRemaining,
        limit: usage.dailyLimit,
        usagePercent: usage.dailyUsagePercent,
        resetsIn: usage.dailyResetsIn,
      },

      weekly: {
        tokensUsed: usage.weeklyTokensUsed,
      },

      lifetime: {
        totalTokensUsed: usage.totalTokensUsed,
        totalMessagesCount: usage.totalMessagesCount,
      },

      usage: {
        tokensUsed: usage.dailyTokensUsed,
        tokensRemaining: usage.dailyTokensRemaining,
        dailyLimit: usage.dailyLimit,
        usagePercentage: usage.dailyUsagePercent,
        resetsIn: usage.dailyResetsIn,
      },
    });
  });
