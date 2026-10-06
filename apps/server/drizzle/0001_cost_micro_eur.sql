ALTER TABLE "cost_tracking" ADD COLUMN "cost_micro_eur" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_tracking" DROP COLUMN "cost_cents";