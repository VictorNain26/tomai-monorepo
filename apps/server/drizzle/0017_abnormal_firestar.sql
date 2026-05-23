-- Drop Stripe columns from family_billing and subscription_plans.
-- Prod DB was created before the drizzle unique-constraint naming convention,
-- so the constraints may not exist under these names (they were previously
-- named differently or dropped in an earlier cleanup). Using IF EXISTS makes
-- the migration idempotent so the deploy is not blocked on name divergence.
ALTER TABLE "family_billing" DROP CONSTRAINT IF EXISTS "family_billing_stripe_customer_id_unique";--> statement-breakpoint
ALTER TABLE "family_billing" DROP CONSTRAINT IF EXISTS "family_billing_stripe_subscription_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_family_billing_stripe_customer";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_family_billing_stripe_subscription";--> statement-breakpoint
ALTER TABLE "family_billing" DROP COLUMN IF EXISTS "stripe_customer_id";--> statement-breakpoint
ALTER TABLE "family_billing" DROP COLUMN IF EXISTS "stripe_subscription_id";--> statement-breakpoint
ALTER TABLE "family_billing" DROP COLUMN IF EXISTS "stripe_metadata";--> statement-breakpoint
ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "stripe_product_id";--> statement-breakpoint
ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "stripe_price_id_first_child";--> statement-breakpoint
ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "stripe_price_id_additional_child";
