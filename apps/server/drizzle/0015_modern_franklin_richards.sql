DROP INDEX "idx_user_stripe_customer_id";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "stripe_customer_id";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "stripe_subscription_id";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "subscription_status";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "subscription_plan";