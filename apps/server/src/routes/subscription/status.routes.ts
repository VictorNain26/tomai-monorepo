/**
 * Status Routes
 *
 * GET /api/subscriptions/status - Get subscription status (DB-driven)
 * GET /api/subscriptions/usage  - Get token usage
 *
 * Security: All routes require authentication and verify caller identity (IDOR protection)
 */

import { Hono } from 'hono';
import { requireParent, requireUser, type AppEnv } from '../../platform/http/context.js';
import { subscriptionService } from '../../services/subscription.service.js';
import { usersRepository } from '../../modules/auth/index.js';
import { verifyParentIdMatch } from './helpers.js';
import { parentChildRepository } from '../../modules/family/index.js';

// Mounted under /api/subscriptions by app.ts.
export const statusRoutes = new Hono<AppEnv>()

  .get('/status', requireParent, async (c) => {
    const authenticatedUser = c.var.user;
    const parentId = c.req.query('parentId');

    if (!parentId) {
      return c.json({ error: 'parentId query parameter required' }, 400);
    }

    const { valid, error: idorError } = verifyParentIdMatch(authenticatedUser.id, parentId);
    if (!valid) {
      return c.json({ error: idorError }, 403);
    }

    return c.json(await subscriptionService.getFamilyStatus(parentId));
  })

  .get('/usage', requireUser, async (c) => {
    const authenticatedUser = c.var.user;
    const userId = c.req.query('userId');

    if (!userId) {
      return c.json({ error: 'userId query parameter required' }, 400);
    }

    const userRecord = await usersRepository.findById(userId);

    if (!userRecord) {
      return c.json({ error: 'User not found' }, 404);
    }

    const isSelfAccess = authenticatedUser.id === userId;
    const isParentAccessingChild =
      authenticatedUser.role === 'parent' &&
      (await parentChildRepository.isLinked(authenticatedUser.id, userRecord.id));

    if (!isSelfAccess && !isParentAccessingChild) {
      return c.json({
        error: "Access denied: You can only view your own usage or your children's usage",
      }, 403);
    }

    const { tokenQuotaService } = await import('../../services/token-quota.service.js');
    const usage = await tokenQuotaService.getUsageStats(userId);

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
        lastResetAt: new Date().toISOString(),
        resetsIn: usage.dailyResetsIn,
      },
    });
  });
