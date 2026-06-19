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
import { subscriptionService } from '../../services/subscription.service.js';
import { usersRepository } from '../../db/repositories/users.repository.js';
import { verifyParentIdMatch } from './helpers.js';
import { parentChildRepository } from '../../db/repositories/parent-child.repository.js';

export const statusRoutes = new Elysia({ prefix: '/api/subscriptions' })
  .use(authMacro)

  .guard({ parentAuth: true })
  .get('/status', async ({ query, status, user: authenticatedUser }) => {
    const parentId = query.parentId;

    if (!parentId) {
      return status(400, { error: 'parentId query parameter required' });
    }

    const { valid, error: idorError } = verifyParentIdMatch(authenticatedUser.id, parentId);
    if (!valid) {
      return status(403, { error: idorError });
    }

    return subscriptionService.getFamilyStatus(parentId);
  })

  .guard({ auth: true })
  .get('/usage', async ({ query, status, user: authenticatedUser }) => {
    const userId = query.userId;

    if (!userId) {
      return status(400, { error: 'userId query parameter required' });
    }

    const userRecord = await usersRepository.findById(userId);

    if (!userRecord) {
      return status(404, { error: 'User not found' });
    }

    const isSelfAccess = authenticatedUser.id === userId;
    const isParentAccessingChild =
      authenticatedUser.role === 'parent' &&
      (await parentChildRepository.isLinked(authenticatedUser.id, userRecord.id));

    if (!isSelfAccess && !isParentAccessingChild) {
      return status(403, {
        error: "Access denied: You can only view your own usage or your children's usage",
      });
    }

    const { tokenQuotaService } = await import('../../services/token-quota.service.js');
    const usage = await tokenQuotaService.getUsageStats(userId);

    return {
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
    };
  });
