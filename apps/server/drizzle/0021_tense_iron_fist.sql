CREATE TYPE "public"."billing_status" AS ENUM('active', 'past_due', 'canceled', 'expired');--> statement-breakpoint
ALTER TABLE "family_billing" ALTER COLUMN "billing_status" SET DEFAULT 'active'::"public"."billing_status";--> statement-breakpoint
ALTER TABLE "family_billing" ALTER COLUMN "billing_status" SET DATA TYPE "public"."billing_status" USING "billing_status"::"public"."billing_status";