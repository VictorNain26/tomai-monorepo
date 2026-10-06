import { pgTable, uuid, varchar, timestamp, integer, pgEnum, index, foreignKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from '../auth/auth.schema';

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

/**
 * Enum for family billing status (RevenueCat-driven).
 *
 * Distinct from subscription_status: these are the exact literals BillingService
 * writes from RevenueCat webhooks — note the US spelling (`canceled`) and
 * `past_due`, which differ from subscription_status' `cancelled`/`paused`.
 */
export const billingStatusEnum = pgEnum('billing_status', ['active', 'past_due', 'canceled', 'expired']);

// =============================================
// TABLES
// =============================================


/**
 * Table user_subscriptions - la formule de chaque élève et ses compteurs de fiches.
 * Pas de ligne : formule Gratuit. La consommation se lit dans `cost_tracking`.
 */
export const userSubscriptions = pgTable('user_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull().unique(), // L'enfant
  plan: subscriptionPlanTypeEnum('plan').notNull().default('free'),
  status: subscriptionStatusEnum('status').notNull().default('active'),
  decksGeneratedToday: integer('decks_generated_today').notNull().default(0),
  lastResetAt: timestamp('last_reset_at', { withTimezone: true }).notNull().defaultNow(),
  decksGeneratedThisMonth: integer('decks_generated_this_month').notNull().default(0),
  lastMonthlyResetAt: timestamp('last_monthly_reset_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'user_subscriptions_user_id_fkey'
  }).onDelete('cascade'),


  index('idx_user_subscriptions_status').on(table.status),
  index('idx_user_subscriptions_last_reset').on(table.lastResetAt),
]);

/**
 * Table family_billing - Facturation centralisée par parent (RevenueCat)
 *
 * RevenueCat est la source unique de vérité : les webhooks INITIAL_PURCHASE /
 * RENEWAL / CANCELLATION / EXPIRATION alimentent cette table. Le calcul du
 * prix (15€ premier enfant + 5€ par enfant supplémentaire) est porté par
 * les produits RevenueCat côté mobile.
 */
export const familyBilling = pgTable('family_billing', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentId: varchar('parent_id', { length: 255 }).notNull().unique(), // Le parent payeur

  // RevenueCat integration (mobile IAP)
  revenuecatCustomerId: varchar('revenuecat_customer_id', { length: 255 }),
  revenuecatSubscriptionId: varchar('revenuecat_subscription_id', { length: 255 }),

  // Status
  billingStatus: billingStatusEnum('billing_status').notNull().default('active'),

  // Billing period
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),

  // Amounts
  monthlyAmountCents: integer('monthly_amount_cents').notNull().default(0),
  lastPaymentAmountCents: integer('last_payment_amount_cents'),
  lastPaymentAt: timestamp('last_payment_at', { withTimezone: true }),

  // Children tracking
  premiumChildrenCount: integer('premium_children_count').notNull().default(0),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.parentId],
    foreignColumns: [user.id],
    name: 'family_billing_parent_id_fkey'
  }).onDelete('cascade'),

  index('idx_family_billing_revenuecat_customer').on(table.revenuecatCustomerId),
  index('idx_family_billing_status').on(table.billingStatus),
]);

// =============================================
// RELATIONS
// =============================================

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(user, {
    fields: [userSubscriptions.userId],
    references: [user.id]
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

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type NewUserSubscription = typeof userSubscriptions.$inferInsert;

export type FamilyBilling = typeof familyBilling.$inferSelect;
export type NewFamilyBilling = typeof familyBilling.$inferInsert;

export type UserSubscriptionWithRelations = UserSubscription & {
  user?: typeof user.$inferSelect;
};

export type FamilyBillingWithRelations = FamilyBilling & {
  parent?: typeof user.$inferSelect;
};
