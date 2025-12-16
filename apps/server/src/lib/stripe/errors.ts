/**
 * Stripe Service Errors
 * Typed error classes for subscription operations
 */

export class StripeServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'StripeServiceError';
  }
}

export class NoPlanConfiguredError extends StripeServiceError {
  constructor() {
    super('NO_PLAN_CONFIGURED', 'Premium plan not configured in database');
  }
}

export class NoSubscriptionError extends StripeServiceError {
  constructor() {
    super('NO_SUBSCRIPTION', 'No active subscription found');
  }
}

export class ExistingSubscriptionError extends StripeServiceError {
  constructor() {
    super('EXISTING_SUBSCRIPTION', 'User already has an active subscription');
  }
}

export class SubscriptionCanceledPendingError extends StripeServiceError {
  constructor() {
    super('SUBSCRIPTION_CANCELED_PENDING', 'Subscription is pending cancellation');
  }
}

export class ParentNotFoundError extends StripeServiceError {
  constructor() {
    super('PARENT_NOT_FOUND', 'Parent user not found');
  }
}

export class NoCustomerError extends StripeServiceError {
  constructor() {
    super('NO_CUSTOMER', 'No Stripe customer found for this parent');
  }
}

export class NoPendingChangesError extends StripeServiceError {
  constructor() {
    super('NO_PENDING_CHANGES', 'No pending changes to cancel');
  }
}

export class SubscriptionFullyCanceledError extends StripeServiceError {
  constructor() {
    super('SUBSCRIPTION_FULLY_CANCELED', 'Subscription is fully canceled. Please create a new subscription.');
  }
}
