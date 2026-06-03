/**
 * Subscription Routes Module
 *
 * Family-based subscription status for TomAI (RevenueCat-driven billing).
 * Purchases, renewals and cancellations are handled by the mobile client
 * through RevenueCat; the server only serves read views + listens to
 * RevenueCat webhooks to update family_billing.
 *
 * Only PARENTS can view their subscription status.
 */

export { statusRoutes } from './status.routes.js';
