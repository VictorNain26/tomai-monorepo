/**
 * Children Management Routes
 *
 * POST /api/subscriptions/add-children - Add children to subscription
 * POST /api/subscriptions/remove-children - Remove children from subscription
 * POST /api/subscriptions/cancel-pending-removal - Cancel scheduled removal
 */

import { Elysia, t } from 'elysia';
import { stripeService, StripeServiceError } from '../../lib/stripe/index.js';
import { db } from '../../db/connection.js';
import { user, userSubscriptions } from '../../db/schema.js';
import { eq, inArray, and } from 'drizzle-orm';
import { verifyParent, formatSubscriptionResponse, getPremiumPlanId } from './helpers.js';
import { logger } from '../../lib/observability.js';

export const childrenRoutes = new Elysia({ prefix: '/api/subscriptions' })
  /**
   * Add Children to Existing Subscription
   * POST /api/subscriptions/add-children
   *
   * Adds additional children to an existing subscription with proration.
   */
  .post(
    '/add-children',
    async ({ body, set }) => {
      const { parentId, childrenIds } = body;

      // Verify parent
      const { isParent, error } = await verifyParent(parentId);
      if (!isParent) {
        set.status = 403;
        return { error };
      }

      // Verify children belong to parent
      const validChildren = await db
        .select({ id: user.id })
        .from(user)
        .where(and(inArray(user.id, childrenIds), eq(user.parentId, parentId)));

      if (validChildren.length !== childrenIds.length) {
        set.status = 400;
        return { error: 'Some children do not belong to this parent' };
      }

      // Filter out children who are already premium
      const premiumPlanId = await getPremiumPlanId();
      let targetChildrenIds = [...childrenIds];
      if (premiumPlanId) {
        const alreadyPremiumChildren = await db
          .select({ userId: userSubscriptions.userId })
          .from(userSubscriptions)
          .where(
            and(
              inArray(userSubscriptions.userId, childrenIds),
              eq(userSubscriptions.planId, premiumPlanId),
              eq(userSubscriptions.status, 'active')
            )
          );

        const alreadyPremiumIds = new Set(alreadyPremiumChildren.map((c) => c.userId));
        targetChildrenIds = childrenIds.filter((id) => !alreadyPremiumIds.has(id));

        if (targetChildrenIds.length === 0) {
          set.status = 400;
          return {
            error: 'All selected children are already Premium',
            code: 'ALL_CHILDREN_PREMIUM',
          };
        }
      }

      try {
        const result = await stripeService.addChildrenToSubscription(parentId, targetChildrenIds);

        // Update children's subscriptions to premium in database
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

        return formatSubscriptionResponse(result, 'premium');
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
        set.status = 500;
        return { error: err instanceof Error ? err.message : 'Failed to add children' };
      }
    },
    {
      body: t.Object({
        parentId: t.String(),
        childrenIds: t.Array(t.String(), { minItems: 1 }),
      }),
    }
  )

  /**
   * Remove Children from Subscription
   * POST /api/subscriptions/remove-children
   *
   * Schedules children for removal at period end (NO immediate downgrade).
   * Children keep Premium access until the billing period ends.
   * The webhook handles the actual downgrade when the schedule phase changes.
   */
  .post(
    '/remove-children',
    async ({ body, set }) => {
      const { parentId, childrenIds } = body;

      // Verify parent
      const { isParent, error } = await verifyParent(parentId);
      if (!isParent) {
        set.status = 403;
        return { error };
      }

      try {
        const result = await stripeService.removeChildrenFromSubscription(parentId, childrenIds);

        // IMPORTANT: Do NOT downgrade children here!
        // Children keep Premium access until period end.
        // The webhook (subscription_schedule.updated) handles the actual downgrade
        // when the schedule phase changes at period end.

        logger.info(`[Subscription] Scheduled removal of ${childrenIds.length} children for parent ${parentId} at period end`, { operation: 'subscription:children:scheduleRemoval', parentId, childrenCount: childrenIds.length });

        return {
          ...formatSubscriptionResponse(result, result.premiumChildrenCount > 0 ? 'premium' : 'free'),
          message: 'Children scheduled for removal at period end. They keep Premium access until then.',
          pendingRemovalChildrenIds: result.pendingRemovalChildrenIds,
          scheduledChildrenCount: result.scheduledChildrenCount,
          scheduledMonthlyAmountCents: result.scheduledMonthlyAmountCents,
        };
      } catch (err) {
        if (err instanceof StripeServiceError) {
          set.status = 400;
          if (err.code === 'SUBSCRIPTION_FULLY_CANCELED') {
            return {
              error: 'Votre abonnement a expiré. Aucune modification n\'est possible.',
              code: err.code,
            };
          }
          return { error: err.message, code: err.code };
        }
        set.status = 500;
        return { error: err instanceof Error ? err.message : 'Failed to remove children' };
      }
    },
    {
      body: t.Object({
        parentId: t.String(),
        childrenIds: t.Array(t.String(), { minItems: 1 }),
      }),
    }
  )

  /**
   * Cancel Pending Removal (Reactivate Children)
   * POST /api/subscriptions/cancel-pending-removal
   *
   * Cancels any scheduled removal of children. This "reactivates" children
   * that were marked for removal at the end of the billing period.
   */
  .post('/cancel-pending-removal', async ({ body, set }) => {
    const { parentId, childId } = body as { parentId?: string; childId?: string };

    if (!parentId) {
      set.status = 400;
      return { error: 'parentId is required' };
    }

    // Verify parent
    const { isParent, error } = await verifyParent(parentId);
    if (!isParent) {
      set.status = 403;
      return { error };
    }

    try {
      // Get the pending removal children IDs BEFORE canceling (from current status)
      const currentStatus = await stripeService.getSubscriptionStatus(parentId);
      const pendingRemovalChildrenIds = currentStatus?.pendingRemovalChildrenIds ?? [];

      // If childId is provided, verify it's actually pending removal
      if (childId && !pendingRemovalChildrenIds.includes(childId)) {
        set.status = 400;
        return { error: 'Child is not pending removal' };
      }

      // Cancel the removal (either for specific child or all children)
      const result = await stripeService.cancelPendingRemoval(parentId, childId);

      // Determine which children to restore to premium
      const childrenToRestore = childId ? [childId] : pendingRemovalChildrenIds;

      // Restore children's plan back to premium in the database
      if (childrenToRestore.length > 0) {
        const premiumPlanId = await getPremiumPlanId();
        if (premiumPlanId) {
          await db
            .update(userSubscriptions)
            .set({
              planId: premiumPlanId,
              status: 'active',
              updatedAt: new Date(),
            })
            .where(inArray(userSubscriptions.userId, childrenToRestore));

          logger.info(`[Subscription] Restored ${childrenToRestore.length} child(ren) to premium after cancel-pending-removal`, { operation: 'subscription:children:restore', childrenCount: childrenToRestore.length });
        }
      }

      // Get updated status to return accurate pending info
      const updatedStatus = await stripeService.getSubscriptionStatus(parentId);

      return {
        success: true,
        message: childId
          ? `Child reactivated - will remain Premium`
          : 'Pending removal canceled - all children reactivated',
        subscription: {
          status: result.status,
          premiumChildrenCount: result.premiumChildrenCount,
          monthlyAmountCents: result.monthlyAmountCents,
          currentPeriodEnd: result.currentPeriodEnd?.toISOString(),
          hasScheduledChanges: updatedStatus?.hasScheduledChanges ?? false,
          pendingRemovalChildrenIds: updatedStatus?.pendingRemovalChildrenIds ?? [],
        },
      };
    } catch (err) {
      logger.error('[Subscription] Cancel pending removal error', { operation: 'subscription:children:cancelRemoval:fail', _error: err instanceof Error ? err.message : String(err), parentId, severity: 'medium' as const });
      set.status = 400;
      return { error: err instanceof Error ? err.message : 'Failed to cancel pending removal' };
    }
  });
