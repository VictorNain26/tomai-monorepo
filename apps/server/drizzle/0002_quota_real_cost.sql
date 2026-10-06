ALTER TABLE "user_subscriptions" DROP CONSTRAINT "user_subscriptions_plan_id_fkey";
--> statement-breakpoint
ALTER TABLE "subscription_plans" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "subscription_plans" CASCADE;--> statement-breakpoint
DROP INDEX "idx_cost_tracking_user_id";--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "plan" "subscription_plan_type" DEFAULT 'free' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_cost_tracking_user_created_at" ON "cost_tracking" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP COLUMN "plan_id";--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP COLUMN "window_tokens_used";--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP COLUMN "window_start_at";--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP COLUMN "tokens_used_today";--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP COLUMN "tokens_used_this_week";--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP COLUMN "last_weekly_reset_at";--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP COLUMN "total_tokens_used";--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP COLUMN "total_messages_count";--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP COLUMN "total_days_active";--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP COLUMN "cancelled_at";--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP COLUMN "metadata";