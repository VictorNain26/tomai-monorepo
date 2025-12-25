/**
 * Stripe Module - TomAI Subscription Management
 *
 * Modèle de tarification par enfant:
 * - Premier enfant: 15€/mois
 * - Enfants supplémentaires: +5€/mois chacun
 *
 * Règles de facturation:
 * - AJOUT: Prorata immédiat (facturation des jours restants)
 * - SUPPRESSION: Pas de remboursement, changement à la fin de période
 * - ANNULATION: À la fin de la période payée
 * - RÉACTIVATION: Possible avant la fin de période sans repayer
 *
 * @see https://docs.stripe.com/api
 * @see https://docs.stripe.com/billing/subscriptions
 */

// Re-export everything for backward compatibility
export { stripe, clearPlanCache, isStripeEnabled, requireStripe } from './config';
export { StripeSubscriptionService } from './service';
export {
  StripeServiceError,
  NoPlanConfiguredError,
  NoSubscriptionError,
  ExistingSubscriptionError,
  SubscriptionCanceledPendingError,
  ParentNotFoundError,
  NoCustomerError,
  NoPendingChangesError,
  SubscriptionFullyCanceledError,
} from './errors';
export type {
  PremiumPlanConfig,
  CheckoutResult,
  SubscriptionInfo,
  ProrataCalculation,
} from './types';

// Export helper for secure JSON parsing
export { parseChildrenIdsFromMetadata } from './helpers';

// Singleton instance
import { StripeSubscriptionService } from './service';
export const stripeService = new StripeSubscriptionService();
