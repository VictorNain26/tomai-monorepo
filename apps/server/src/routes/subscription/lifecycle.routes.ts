/**
 * Subscription Lifecycle Routes
 *
 * POST /api/subscriptions/cancel - Cancel subscription
 * POST /api/subscriptions/resume - Resume canceled subscription
 * GET /api/subscriptions/preview-add-children - Preview prorata calculation
 *
 * Security: All routes require authentication and verify caller === parentId
 */

import { Elysia, t } from 'elysia';
import { stripeService, StripeServiceError } from '../../lib/stripe/index.js';
import { getAuthenticatedParent, verifyParentIdMatch, formatSubscriptionResponse } from './helpers.js';

export const lifecycleRoutes = new Elysia({ prefix: '/api/subscriptions' })
  /**
   * Cancel Subscription (at period end)
   * POST /api/subscriptions/cancel
   *
   * Security: Verifies authenticated user === body.parentId (IDOR protection)
   */
  .post(
    '/cancel',
    async ({ body, set, request }) => {
      const { parentId } = body;

      // SECURITY: Get authenticated parent and verify identity match
      const { parent, error: authError, status: authStatus } = await getAuthenticatedParent(request.headers);
      if (!parent) {
        set.status = authStatus ?? 401;
        return { error: authError };
      }

      // SECURITY: Verify caller is accessing their own subscription (IDOR protection)
      const { valid, error: idorError } = verifyParentIdMatch(parent.id, parentId);
      if (!valid) {
        set.status = 403;
        return { error: idorError };
      }

      try {
        const result = await stripeService.cancelSubscription(parentId);

        return {
          success: true,
          message: 'Subscription will be canceled at period end',
          subscription: {
            id: result.subscriptionId,
            status: result.status,
            cancelAtPeriodEnd: result.cancelAtPeriodEnd,
            currentPeriodEnd: result.currentPeriodEnd.toISOString(),
          },
        };
      } catch (err) {
        set.status = 404;
        return { error: err instanceof Error ? err.message : 'Cancellation failed' };
      }
    },
    {
      body: t.Object({
        parentId: t.String(),
      }),
    }
  )

  /**
   * Resume Canceled Subscription
   * POST /api/subscriptions/resume
   *
   * Security: Verifies authenticated user === body.parentId (IDOR protection)
   */
  .post(
    '/resume',
    async ({ body, set, request }) => {
      const { parentId } = body;

      // SECURITY: Get authenticated parent and verify identity match
      const { parent, error: authError, status: authStatus } = await getAuthenticatedParent(request.headers);
      if (!parent) {
        set.status = authStatus ?? 401;
        return { error: authError };
      }

      // SECURITY: Verify caller is accessing their own subscription (IDOR protection)
      const { valid, error: idorError } = verifyParentIdMatch(parent.id, parentId);
      if (!valid) {
        set.status = 403;
        return { error: idorError };
      }

      try {
        const result = await stripeService.resumeSubscription(parentId);

        return {
          success: true,
          message: 'Subscription resumed successfully',
          subscription: formatSubscriptionResponse(result, 'premium'),
        };
      } catch (err) {
        if (err instanceof StripeServiceError) {
          set.status = 400;
          if (err.code === 'SUBSCRIPTION_FULLY_CANCELED') {
            return {
              error: 'Votre abonnement a expiré. Veuillez créer un nouvel abonnement.',
              code: err.code,
              action: 'CREATE_NEW_SUBSCRIPTION',
            };
          }
          return { error: err.message, code: err.code };
        }
        set.status = 404;
        return { error: err instanceof Error ? err.message : 'Resume failed' };
      }
    },
    {
      body: t.Object({
        parentId: t.String(),
      }),
    }
  )

  /**
   * Preview Add Children (Calculate Prorata)
   * GET /api/subscriptions/preview-add-children?parentId=xxx&childrenCount=2
   *
   * Returns the exact prorata amount that will be charged when adding children.
   * Use this before showing the confirmation modal.
   *
   * Security: Verifies authenticated user === query.parentId (IDOR protection)
   */
  .get('/preview-add-children', async ({ query, set, request }) => {
    const parentId = query.parentId;
    const childrenCount = parseInt(query.childrenCount ?? '1', 10);

    if (!parentId) {
      set.status = 400;
      return { error: 'parentId query parameter required' };
    }

    if (childrenCount < 1) {
      set.status = 400;
      return { error: 'childrenCount must be at least 1' };
    }

    // SECURITY: Get authenticated parent and verify identity match
    const { parent, error: authError, status: authStatus } = await getAuthenticatedParent(request.headers);
    if (!parent) {
      set.status = authStatus ?? 401;
      return { error: authError };
    }

    // SECURITY: Verify caller is accessing their own subscription (IDOR protection)
    const { valid, error: idorError } = verifyParentIdMatch(parent.id, parentId);
    if (!valid) {
      set.status = 403;
      return { error: idorError };
    }

    try {
      const prorata = await stripeService.calculateAddChildrenProrata(parentId, childrenCount);

      return {
        childrenCount,
        prorata: {
          amountCents: prorata.prorataAmountCents,
          amount: prorata.prorataAmount,
          daysRemaining: prorata.daysRemaining,
          totalDaysInPeriod: prorata.totalDaysInPeriod,
          currentPeriodEnd: prorata.currentPeriodEnd.toISOString(),
        },
        newSubscription: {
          monthlyAmountCents: prorata.newMonthlyAmountCents,
          monthlyAmount: prorata.newMonthlyAmount,
        },
        pricePerChildCents: prorata.pricePerChildCents,
        pricePerChild: `${(prorata.pricePerChildCents / 100).toFixed(2)}€`,
      };
    } catch (err) {
      set.status = 400;
      return { error: err instanceof Error ? err.message : 'Failed to calculate prorata' };
    }
  });
