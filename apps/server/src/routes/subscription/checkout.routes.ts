/**
 * Checkout Routes
 *
 * POST /api/subscriptions/checkout - Create Checkout session
 *
 * Security: All routes require authentication and verify caller === parentId
 */

import { Elysia, t } from 'elysia';
import { stripeService, StripeServiceError } from '../../lib/stripe/index.js';
import { db } from '../../db/connection.js';
import { user, userSubscriptions } from '../../db/schema.js';
import { eq, inArray, and } from 'drizzle-orm';
import { getAuthenticatedParent, verifyParentIdMatch, getChildrenForParent, getPremiumPlanId } from './helpers.js';

export const checkoutRoutes = new Elysia({ prefix: '/api/subscriptions' })
  /**
   * Create Stripe Checkout Session
   * POST /api/subscriptions/checkout
   *
   * Creates a checkout session for upgrading children to Premium.
   * If no childrenIds provided, upgrades all parent's children.
   *
   * Security: Verifies authenticated user === body.parentId (IDOR protection)
   */
  .post(
    '/checkout',
    async ({ body, set, request }) => {
      const { parentId, childrenIds } = body;

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

      // Get children to upgrade
      let targetChildren = childrenIds;

      if (!targetChildren || targetChildren.length === 0) {
        // Get all children for this parent
        targetChildren = await getChildrenForParent(parentId);

        if (targetChildren.length === 0) {
          set.status = 400;
          return { error: 'No children found for this parent' };
        }
      }

      // Verify all children belong to this parent
      const validChildren = await db
        .select({ id: user.id })
        .from(user)
        .where(and(inArray(user.id, targetChildren), eq(user.parentId, parentId)));

      if (validChildren.length !== targetChildren.length) {
        set.status = 400;
        return { error: 'Some children do not belong to this parent' };
      }

      // Filter out children who are already premium (protection against double subscription)
      const premiumPlanId = await getPremiumPlanId();
      if (premiumPlanId) {
        const alreadyPremiumChildren = await db
          .select({ userId: userSubscriptions.userId })
          .from(userSubscriptions)
          .where(
            and(
              inArray(userSubscriptions.userId, targetChildren),
              eq(userSubscriptions.planId, premiumPlanId),
              eq(userSubscriptions.status, 'active')
            )
          );

        const alreadyPremiumIds = new Set(alreadyPremiumChildren.map((c) => c.userId));
        targetChildren = targetChildren.filter((id) => !alreadyPremiumIds.has(id));

        if (targetChildren.length === 0) {
          set.status = 400;
          return {
            error: 'All selected children are already Premium',
            code: 'ALL_CHILDREN_PREMIUM',
          };
        }
      }

      try {
        const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

        const result = await stripeService.createCheckoutSession({
          parentId,
          childrenIds: targetChildren,
          successUrl: `${frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${frontendUrl}/subscription/cancel`,
        });

        return {
          sessionId: result.sessionId,
          url: result.url,
          childrenCount: targetChildren.length,
        };
      } catch (err) {
        // Handle typed Stripe service errors
        if (err instanceof StripeServiceError) {
          set.status = 400;

          if (err.code === 'EXISTING_SUBSCRIPTION') {
            return {
              error: 'Vous avez déjà un abonnement actif. Utilisez "Ajouter des enfants" pour ajouter de nouveaux enfants.',
              code: err.code,
            };
          }

          if (err.code === 'SUBSCRIPTION_CANCELED_PENDING') {
            return {
              error: 'Votre abonnement est en cours d\'annulation. Utilisez "Ajouter des enfants" pour réactiver et ajouter de nouveaux enfants, ou attendez la fin de la période pour créer un nouvel abonnement.',
              code: err.code,
            };
          }

          // Generic service error
          return { error: err.message, code: err.code };
        }

        // Unexpected error
        set.status = 500;
        return { error: err instanceof Error ? err.message : 'Checkout failed' };
      }
    },
    {
      body: t.Object({
        parentId: t.String(),
        childrenIds: t.Optional(t.Array(t.String())),
      }),
    }
  );
