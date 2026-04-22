ALTER TABLE "family_billing" DROP CONSTRAINT "family_billing_stripe_customer_id_unique";--> statement-breakpoint
ALTER TABLE "family_billing" DROP CONSTRAINT "family_billing_stripe_subscription_id_unique";--> statement-breakpoint
DROP INDEX "idx_family_billing_stripe_customer";--> statement-breakpoint
DROP INDEX "idx_family_billing_stripe_subscription";--> statement-breakpoint
ALTER TABLE "family_billing" DROP COLUMN "stripe_customer_id";--> statement-breakpoint
ALTER TABLE "family_billing" DROP COLUMN "stripe_subscription_id";--> statement-breakpoint
ALTER TABLE "family_billing" DROP COLUMN "stripe_metadata";--> statement-breakpoint
ALTER TABLE "subscription_plans" DROP COLUMN "stripe_product_id";--> statement-breakpoint
ALTER TABLE "subscription_plans" DROP COLUMN "stripe_price_id_first_child";--> statement-breakpoint
ALTER TABLE "subscription_plans" DROP COLUMN "stripe_price_id_additional_child";