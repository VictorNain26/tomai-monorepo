/**
 * Subscription Routes Module
 *
 * Family-based subscription management for TomAI with per-child pricing:
 * - First child: 15€/month
 * - Additional children: +5€/month each (with proration)
 *
 * Only PARENTS can manage subscriptions.
 */

export { checkoutRoutes } from './checkout.routes.js';
export { childrenRoutes } from './children.routes.js';
export { statusRoutes } from './status.routes.js';
export { lifecycleRoutes } from './lifecycle.routes.js';

// Re-export helpers for external use
export {
  verifyParent,
  getChildrenForParent,
  formatSubscriptionResponse,
} from './helpers.js';
