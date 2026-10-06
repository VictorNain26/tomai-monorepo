DROP INDEX "idx_user_subscriptions_last_reset";--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP COLUMN "decks_generated_today";--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP COLUMN "last_reset_at";--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP COLUMN "decks_generated_this_month";--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP COLUMN "last_monthly_reset_at";