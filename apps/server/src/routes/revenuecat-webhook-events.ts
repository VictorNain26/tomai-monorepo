import { logger } from '../lib/observability';
import { DEFAULT_PERIOD_MS } from '../lib/stripe/helpers';
import { billingService } from '../services/billing';

// ============================================
// Types
// ============================================

export interface RevenueCatEvent {
  api_version: string;
  event: {
    type: RevenueCatEventType;
    id: string;
    app_id: string;
    app_user_id: string;
    original_app_user_id: string;
    aliases: string[];
    product_id: string;
    entitlement_ids: string[];
    event_timestamp_ms: number;
    purchased_at_ms?: number;
    expiration_at_ms?: number;
    store: string;
    environment: 'SANDBOX' | 'PRODUCTION';
    price?: number;
    currency?: string;
    period_type?: string;
    cancel_reason?: string;
    expiration_reason?: string;
    new_product_id?: string;
    subscriber_attributes?: Record<string, { value: string; updated_at_ms: number }>;
  };
}

export type RevenueCatEventType =
  | 'TEST'
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'NON_RENEWING_PURCHASE'
  | 'SUBSCRIPTION_PAUSED'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'PRODUCT_CHANGE'
  | 'TRANSFER'
  | 'SUBSCRIPTION_EXTENDED'
  | 'TEMPORARY_ENTITLEMENT_GRANT';

// ============================================
// Helpers
// ============================================

function parseChildrenIds(attributes?: Record<string, { value: string }>): string[] {
  const childrenIdsAttr = attributes?.children_ids?.value;
  if (!childrenIdsAttr) return [];

  try {
    const parsed = JSON.parse(childrenIdsAttr);
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
      return parsed;
    }
  } catch {
    // Invalid JSON
  }

  return [];
}

// ============================================
// Event Handlers
// ============================================

export async function handleInitialPurchase(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;
  const childrenIds = parseChildrenIds(event.subscriber_attributes);

  const expirationAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms)
    : new Date(Date.now() + DEFAULT_PERIOD_MS);

  await billingService.activatePremium({
    parentId,
    childrenIds,
    period: {
      start: new Date(event.purchased_at_ms ?? Date.now()),
      end: expirationAt,
    },
    premiumChildrenCount: childrenIds.length || 1,
    source: {
      provider: 'revenuecat',
      customerId: event.original_app_user_id,
      productId: event.product_id,
    },
  });

  logger.info(`[RevenueCat Webhook] Initial purchase for parent ${parentId}`, {
    operation: 'revenuecat:webhook:initial_purchase',
    parentId,
    productId: event.product_id,
    childrenCount: childrenIds.length,
  });
}

export async function handleRenewal(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;
  const childrenIds = parseChildrenIds(event.subscriber_attributes);

  const expirationAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms)
    : new Date(Date.now() + DEFAULT_PERIOD_MS);

  await billingService.extendActivePeriod({
    parentId,
    childrenIds,
    period: {
      start: new Date(event.purchased_at_ms ?? Date.now()),
      end: expirationAt,
    },
    resetChildCounters: true,
  });

  logger.info(`[RevenueCat Webhook] Renewal for parent ${parentId}`, {
    operation: 'revenuecat:webhook:renewal',
    parentId,
  });
}

export async function handleCancellation(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;
  await billingService.markCanceled(parentId);
  logger.info(`[RevenueCat Webhook] Cancellation for parent ${parentId}`, {
    operation: 'revenuecat:webhook:cancellation',
    parentId,
    reason: event.cancel_reason,
  });
}

export async function handleExpiration(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;
  const childrenIds = parseChildrenIds(event.subscriber_attributes);

  await billingService.expireAndDowngrade(parentId, childrenIds);

  logger.info(`[RevenueCat Webhook] Expiration for parent ${parentId}`, {
    operation: 'revenuecat:webhook:expiration',
    parentId,
    reason: event.expiration_reason,
    childrenDowngraded: childrenIds.length,
  });
}

export async function handleBillingIssue(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;
  // RevenueCat's BILLING_ISSUE event does not carry children attributes;
  // children remain on their current plan and will be reconciled on the next
  // RENEWAL or EXPIRATION event.
  await billingService.markPastDue(parentId, []);
  logger.warn(`[RevenueCat Webhook] Billing issue for parent ${parentId}`, {
    operation: 'revenuecat:webhook:billing_issue',
    parentId,
    severity: 'medium' as const,
  });
}

export async function handleUncancellation(event: RevenueCatEvent['event']): Promise<void> {
  const parentId = event.app_user_id;
  await billingService.markUncanceled(parentId);
  logger.info(`[RevenueCat Webhook] Uncancellation for parent ${parentId}`, {
    operation: 'revenuecat:webhook:uncancellation',
    parentId,
  });
}
