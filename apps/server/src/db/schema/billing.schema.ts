import { pgTable, uuid, varchar, timestamp, boolean, integer, jsonb, pgEnum, index, foreignKey } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { user } from './auth.schema';

// =============================================
// ENUMS
// =============================================

/**
 * Enum for subscription plan types
 */
export const subscriptionPlanTypeEnum = pgEnum('subscription_plan_type', ['free', 'premium']);

/**
 * Enum for subscription status
 */
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'paused', 'cancelled', 'expired']);

// =============================================
// TABLES
// =============================================

/**
 * Table subscription_plans - Définition des plans d'abonnement
 *
 * Modèle de tarification TomIA:
 * - Free: 5000 tokens/jour, 1 enfant max
 * - Premium: 50000 tokens/jour par enfant, tarification par enfant (15€ + 5€)
 */
export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(), // 'free' | 'premium'
  type: subscriptionPlanTypeEnum('type').notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),

  // Token quotas
  dailyTokenLimit: integer('daily_token_limit').notNull(),
  resetIntervalHours: integer('reset_interval_hours').notNull().default(24),

  // Pricing (en centimes)
  priceFirstChildCents: integer('price_first_child_cents').notNull().default(0),
  priceAdditionalChildCents: integer('price_additional_child_cents').notNull().default(0),
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),

  // Stripe IDs
  stripeProductId: varchar('stripe_product_id', { length: 255 }),
  stripePriceIdFirstChild: varchar('stripe_price_id_first_child', { length: 255 }),
  stripePriceIdAdditionalChild: varchar('stripe_price_id_additional_child', { length: 255 }),

  // Features list
  features: jsonb('features').default(sql`'[]'::jsonb`),

  // Status
  isActive: boolean('is_active').notNull().default(true),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Table user_subscriptions - Abonnement individuel par enfant
 *
 * Chaque enfant a son propre enregistrement avec:
 * - Plan associé (free ou premium)
 * - Compteur de tokens journalier
 * - Date de dernier reset
 */
export const userSubscriptions = pgTable('user_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull().unique(), // L'enfant
  planId: uuid('plan_id').notNull(),
  status: subscriptionStatusEnum('status').notNull().default('active'),

  // ===== ROLLING WINDOW 5H (nouveau système) =====
  // Tokens utilisés dans la fenêtre actuelle de 5h
  windowTokensUsed: integer('window_tokens_used').notNull().default(0),
  // Début de la fenêtre actuelle
  windowStartAt: timestamp('window_start_at', { withTimezone: true }).notNull().defaultNow(),

  // ===== DAILY CAP (sécurité anti-abus) =====
  // Reset quotidien à 10h Paris - limite max journalière
  tokensUsedToday: integer('tokens_used_today').notNull().default(0),
  decksGeneratedToday: integer('decks_generated_today').notNull().default(0),
  lastResetAt: timestamp('last_reset_at', { withTimezone: true }).notNull().defaultNow(),

  // Monthly usage tracking (reset le 1er du mois)
  decksGeneratedThisMonth: integer('decks_generated_this_month').notNull().default(0),
  lastMonthlyResetAt: timestamp('last_monthly_reset_at', { withTimezone: true }).notNull().defaultNow(),

  // ===== WEEKLY STATS (pour dashboard parent) =====
  tokensUsedThisWeek: integer('tokens_used_this_week').notNull().default(0),
  lastWeeklyResetAt: timestamp('last_weekly_reset_at', { withTimezone: true }).notNull().defaultNow(),

  // Usage statistics (lifetime)
  totalTokensUsed: integer('total_tokens_used').notNull().default(0),
  totalMessagesCount: integer('total_messages_count').notNull().default(0),
  totalDaysActive: integer('total_days_active').notNull().default(0),

  // Subscription lifecycle
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

  // Metadata
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'user_subscriptions_user_id_fkey'
  }).onDelete('cascade'),

  planIdFk: foreignKey({
    columns: [table.planId],
    foreignColumns: [subscriptionPlans.id],
    name: 'user_subscriptions_plan_id_fkey'
  }).onDelete('restrict'),

  statusIdx: index('idx_user_subscriptions_status').on(table.status),
  lastResetIdx: index('idx_user_subscriptions_last_reset').on(table.lastResetAt),
}));

/**
 * Table family_billing - Facturation centralisée par parent
 *
 * Le parent gère la facturation Stripe pour tous ses enfants:
 * - Un seul abonnement Stripe par famille
 * - Calcul automatique: 15€ premier enfant + 5€ par enfant supplémentaire
 * - Prorata lors d'ajout/suppression d'enfants
 */
export const familyBilling = pgTable('family_billing', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentId: varchar('parent_id', { length: 255 }).notNull().unique(), // Le parent payeur

  // Stripe integration (web - legacy)
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).unique(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).unique(),

  // RevenueCat integration (mobile)
  revenuecatCustomerId: varchar('revenuecat_customer_id', { length: 255 }),
  revenuecatSubscriptionId: varchar('revenuecat_subscription_id', { length: 255 }),

  // Status (shared)
  billingStatus: varchar('billing_status', { length: 50 }).notNull().default('active'), // active, past_due, canceled, expired

  // Billing period
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),

  // Amounts
  monthlyAmountCents: integer('monthly_amount_cents').notNull().default(0),
  lastPaymentAmountCents: integer('last_payment_amount_cents'),
  lastPaymentAt: timestamp('last_payment_at', { withTimezone: true }),

  // Children tracking
  premiumChildrenCount: integer('premium_children_count').notNull().default(0),

  // Stripe metadata for reconciliation
  stripeMetadata: jsonb('stripe_metadata').default(sql`'{}'::jsonb`),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  parentIdFk: foreignKey({
    columns: [table.parentId],
    foreignColumns: [user.id],
    name: 'family_billing_parent_id_fkey'
  }).onDelete('cascade'),

  stripeCustomerIdx: index('idx_family_billing_stripe_customer').on(table.stripeCustomerId),
  stripeSubscriptionIdx: index('idx_family_billing_stripe_subscription').on(table.stripeSubscriptionId),
  revenuecatCustomerIdx: index('idx_family_billing_revenuecat_customer').on(table.revenuecatCustomerId),
  billingStatusIdx: index('idx_family_billing_status').on(table.billingStatus),
}));

/**
 * Table webhook_events - Stocke les événements traités pour idempotence
 * Remplace Redis pour la déduplication Stripe/RevenueCat
 * TTL géré par cleanup job (événements > 7 jours supprimés)
 */
export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: varchar('event_id', { length: 255 }).notNull().unique(), // ID Stripe/RevenueCat
  source: varchar('source', { length: 50 }).notNull(), // 'stripe' | 'revenuecat'
  eventType: varchar('event_type', { length: 100 }).notNull(), // Type d'événement
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), // Pour cleanup
}, (table) => ({
  eventIdIdx: index('idx_webhook_events_event_id').on(table.eventId),
  sourceIdx: index('idx_webhook_events_source').on(table.source),
  expiresAtIdx: index('idx_webhook_events_expires_at').on(table.expiresAt),
}));

/**
 * Table waitlist_entries - Collecte d'emails pour la liste d'attente
 * Utilisée par la landing page avant le lancement de l'app mobile
 */
export const waitlistEntries = pgTable('waitlist_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  source: varchar('source', { length: 50 }), // ex: "landing-hero", "pricing-free"
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: index('idx_waitlist_entries_email').on(table.email),
}));

// =============================================
// RELATIONS
// =============================================

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  userSubscriptions: many(userSubscriptions),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(user, {
    fields: [userSubscriptions.userId],
    references: [user.id]
  }),
  plan: one(subscriptionPlans, {
    fields: [userSubscriptions.planId],
    references: [subscriptionPlans.id]
  }),
}));

export const familyBillingRelations = relations(familyBilling, ({ one }) => ({
  parent: one(user, {
    fields: [familyBilling.parentId],
    references: [user.id]
  }),
}));

// =============================================
// TYPES
// =============================================
export type SubscriptionPlanTypeEnum = typeof subscriptionPlanTypeEnum.enumValues[number];
export type SubscriptionStatusEnum = typeof subscriptionStatusEnum.enumValues[number];

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type NewUserSubscription = typeof userSubscriptions.$inferInsert;

export type FamilyBilling = typeof familyBilling.$inferSelect;
export type NewFamilyBilling = typeof familyBilling.$inferInsert;

export type UserSubscriptionWithRelations = UserSubscription & {
  user?: typeof user.$inferSelect;
  plan?: SubscriptionPlan;
};

export type FamilyBillingWithRelations = FamilyBilling & {
  parent?: typeof user.$inferSelect;
};

// Webhook Events Types (idempotence sans Redis)
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
export type WebhookSource = 'stripe' | 'revenuecat';

// Waitlist Types
export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export type NewWaitlistEntry = typeof waitlistEntries.$inferInsert;
